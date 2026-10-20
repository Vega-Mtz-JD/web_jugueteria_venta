-- Funciones del panel: estados de pedido, administradores, borrar producto y resumen
-- (spec del panel §5.2, §5.3, §5.5 y §5.6). Todas validan public.require_admin().

-- Comprobante de la encomienda ------------------------------------------------------------------
alter table public.orders add column shipping_proof_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shipping-proofs', 'shipping-proofs', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;

-- Ruta: <order_id>/<archivo>
create policy "comprobantes de envío: admin sube" on storage.objects
  for insert to authenticated with check (bucket_id = 'shipping-proofs' and (select public.is_admin()));
create policy "comprobantes de envío: admin edita" on storage.objects
  for update to authenticated using (bucket_id = 'shipping-proofs' and (select public.is_admin()));
create policy "comprobantes de envío: admin borra" on storage.objects
  for delete to authenticated using (bucket_id = 'shipping-proofs' and (select public.is_admin()));
create policy "comprobantes de envío: el comprador lee los suyos, admin todos" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'shipping-proofs'
    and (
      (select public.is_admin())
      or exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1] and o.customer_id = (select auth.uid())
      )
    )
  );

-- Estados de pedido ---------------------------------------------------------------------------------
create or replace function public.order_status_label(p_status public.order_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'esperando_pago' then 'Esperando pago'
    when 'en_revision' then 'En revisión'
    when 'pagado' then 'Pagado'
    when 'enviado' then 'Enviado'
    when 'listo_para_recoger' then 'Listo para recoger'
    when 'entregado' then 'Entregado'
    when 'rechazado' then 'Rechazado'
    when 'cancelado' then 'Cancelado'
    when 'reembolsado' then 'Reembolsado'
  end;
$$;

create or replace function public.admin_set_order_status(
  p_order_id uuid,
  p_expected_from public.order_status,
  p_to public.order_status,
  p_rejection_reason text default null,
  p_shipping_agency text default null,
  p_tracking_code text default null,
  p_shipping_proof_path text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_reason text := nullif(trim(p_rejection_reason), '');
  v_agency text := nullif(trim(p_shipping_agency), '');
  v_tracking text := nullif(trim(p_tracking_code), '');
  v_note text;
begin
  perform public.require_admin();

  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then
    raise exception 'Ese pedido no existe' using errcode = 'P0001';
  end if;
  -- Otro administrador lo movió mientras esta pantalla estaba abierta.
  if v_order.status <> p_expected_from then
    raise exception 'Este pedido ya cambió; recarga la página' using errcode = 'P0001';
  end if;

  if not (
       (v_order.status = 'en_revision' and p_to in ('pagado', 'rechazado'))
    or (v_order.status = 'pagado' and p_to = 'listo_para_recoger' and v_order.delivery_method = 'recojo')
    or (v_order.status = 'pagado' and p_to = 'enviado' and v_order.delivery_method in ('envio_ciudad', 'encomienda'))
    or (v_order.status in ('enviado', 'listo_para_recoger') and p_to = 'entregado')
    or (v_order.status in ('pagado', 'enviado', 'listo_para_recoger') and p_to = 'reembolsado')
    or (v_order.status in ('esperando_pago', 'rechazado') and p_to = 'cancelado')
  ) then
    raise exception 'No se puede pasar de «%» a «%»',
      public.order_status_label(v_order.status), public.order_status_label(p_to)
      using errcode = 'P0001';
  end if;

  if p_to = 'rechazado' then
    if v_reason is null then
      raise exception 'Escribe el motivo del rechazo' using errcode = 'P0001';
    end if;
    v_note := v_reason;
  elsif p_to = 'enviado' then
    if v_order.delivery_method = 'encomienda' and (v_agency is null or v_tracking is null) then
      raise exception 'Escribe la agencia y el número de guía' using errcode = 'P0001';
    end if;
    v_note := nullif(concat_ws(' · ', v_agency, 'guía ' || v_tracking), '');
  elsif p_to = 'reembolsado' then
    v_note := 'Reembolsado';
  end if;

  if p_to in ('reembolsado', 'cancelado') then
    perform public.restock_order(p_order_id);
  end if;

  perform set_config('app.actor', 'admin', true);
  perform set_config('app.note', coalesce(v_note, ''), true);
  update public.orders o
  set status = p_to,
      rejection_reason = case when p_to = 'rechazado' then v_reason else o.rejection_reason end,
      shipping_agency = case when p_to = 'enviado' then v_agency else o.shipping_agency end,
      tracking_code = case when p_to = 'enviado' then v_tracking else o.tracking_code end,
      shipping_proof_path = case when p_to = 'enviado' then nullif(trim(p_shipping_proof_path), '') else o.shipping_proof_path end
  where o.id = p_order_id;
  perform set_config('app.actor', '', true);
  perform set_config('app.note', '', true);
end;
$$;

-- Administradores ------------------------------------------------------------------------------------
create or replace function public.admin_list_admins()
returns table (id uuid, email text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select p.id, u.email::text, p.full_name
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.role = 'admin'
  order by p.created_at;
end;
$$;

create or replace function public.admin_set_admin(p_email text, p_make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid;
  v_admins int;
begin
  perform public.require_admin();

  select u.id into v_target from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_target is null then
    raise exception 'Esa persona primero debe crear su cuenta en la tienda' using errcode = 'P0001';
  end if;

  if p_make_admin then
    update public.profiles p set role = 'admin' where p.id = v_target;
    return;
  end if;

  if v_target = auth.uid() then
    raise exception 'No puedes quitarte a ti mismo' using errcode = 'P0001';
  end if;
  -- Dos administradores quitándose uno al otro a la vez: se bloquean y el segundo vuelve a comprobar.
  perform 1 from public.profiles p where p.role = 'admin' order by p.id for update;
  perform public.require_admin();
  select count(*) into v_admins from public.profiles p where p.role = 'admin' and p.id <> v_target;
  if v_admins < 1 then
    raise exception 'Debe quedar al menos un administrador' using errcode = 'P0001';
  end if;
  update public.profiles p set role = 'customer' where p.id = v_target;
end;
$$;

-- Borrar producto: si ya se vendió alguna vez se oculta (los pedidos lo necesitan) ----------------
create or replace function public.admin_delete_product(p_product_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  if exists (select 1 from public.order_items i where i.product_id = p_product_id)
     or exists (select 1 from public.manual_sales s where s.product_id = p_product_id) then
    update public.products p set is_active = false where p.id = p_product_id;
    return 'oculto';
  end if;
  delete from public.products p where p.id = p_product_id;
  if not found then
    raise exception 'Ese producto ya no existe' using errcode = 'P0001';
  end if;
  return 'borrado';
end;
$$;

-- Resumen de la portada ----------------------------------------------------------------------------------
-- Venta = productos de pedidos pagados (fechados al confirmar el pago) + ventas manuales no anuladas.
create or replace function public.admin_dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/La_Paz')::date;
  v_month date := date_trunc('month', now() at time zone 'America/La_Paz')::date;
  v_result jsonb;
begin
  perform public.require_admin();

  with web as (
    select o.subtotal_cents, o.delivery_fee_cents,
      (select (max(e.created_at) at time zone 'America/La_Paz')::date
       from public.order_events e where e.order_id = o.id and e.to_status = 'pagado') as day
    from public.orders o
    where o.status in ('pagado', 'enviado', 'listo_para_recoger', 'entregado')
  ),
  manual as (
    select s.quantity * s.unit_price_cents as cents, (s.created_at at time zone 'America/La_Paz')::date as day
    from public.manual_sales s
    where s.voided_at is null
  ),
  sales as (
    select subtotal_cents as cents, delivery_fee_cents as fee, day from web
    union all
    select cents, 0, day from manual
  )
  select jsonb_build_object(
    'pendingReview', (select count(*) from public.orders o where o.status = 'en_revision'),
    'pendingReviewOver24h', (select count(*) from public.orders o
                             where o.status = 'en_revision' and o.status_changed_at < now() - interval '24 hours'),
    'toDeliver', (select count(*) from public.orders o where o.status in ('pagado', 'enviado', 'listo_para_recoger')),
    'salesToday', jsonb_build_object(
      'cents', (select coalesce(sum(cents), 0) from sales where day = v_today),
      'count', (select count(*) from sales where day = v_today)),
    'salesMonth', jsonb_build_object(
      'cents', (select coalesce(sum(cents), 0) from sales where day >= v_month),
      'count', (select count(*) from sales where day >= v_month)),
    'shippingMonthCents', (select coalesce(sum(fee), 0) from sales where day >= v_month),
    'lowStock', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'stock', p.stock) order by p.stock, p.name)
                          from public.products p where p.is_active and p.stock between 1 and 3), '[]'::jsonb),
    'outOfStock', (select count(*) from public.products p where p.is_active and p.stock = 0)
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.admin_set_order_status(uuid, public.order_status, public.order_status, text, text, text, text) from public, anon;
revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_set_admin(text, boolean) from public, anon;
revoke execute on function public.admin_delete_product(uuid) from public, anon;
revoke execute on function public.admin_dashboard_summary() from public, anon;
grant execute on function public.admin_set_order_status(uuid, public.order_status, public.order_status, text, text, text, text) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_set_admin(text, boolean) to authenticated;
grant execute on function public.admin_delete_product(uuid) to authenticated;
grant execute on function public.admin_dashboard_summary() to authenticated;
