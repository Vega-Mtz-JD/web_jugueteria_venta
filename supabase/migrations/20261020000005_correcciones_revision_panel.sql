-- Correcciones de la revisión final del plan 3A.

-- 1) Borrar productos de prueba: también se ocultan (no se borran) las muestras con ventas manuales.
create or replace function public.delete_sample_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  hidden integer;
  deleted integer;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar los productos de prueba'
      using errcode = '42501';
  end if;

  update public.products p set is_active = false
  where p.is_sample
    and (exists (select 1 from public.order_items i where i.product_id = p.id)
         or exists (select 1 from public.manual_sales s where s.product_id = p.id));
  get diagnostics hidden = row_count;

  delete from public.products p
  where p.is_sample
    and not exists (select 1 from public.order_items i where i.product_id = p.id)
    and not exists (select 1 from public.manual_sales s where s.product_id = p.id);
  get diagnostics deleted = row_count;

  return hidden + deleted;
end;
$$;

-- 2) Venta manual con identificador de envío: si la respuesta se pierde y el dueño vuelve a tocar,
--    no se registra dos veces (mismo patrón que orders.request_id).
alter table public.manual_sales add column request_id uuid unique;

drop function public.admin_record_manual_sale(uuid, int, text, int, text);

create or replace function public.admin_record_manual_sale(
  p_product_id uuid, p_quantity int, p_channel text, p_unit_price_cents int, p_note text default null, p_request_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_hold record;
  v_sale_id uuid;
begin
  perform public.require_admin();

  if p_request_id is not null then
    select s.id into v_sale_id from public.manual_sales s where s.request_id = p_request_id;
    if found then
      return v_sale_id;
    end if;
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'La cantidad debe ser entre 1 y 100' using errcode = 'P0001';
  end if;
  if p_channel is null or p_channel not in ('tienda', 'whatsapp') then
    raise exception 'Elige dónde se vendió: en la tienda o por WhatsApp' using errcode = 'P0001';
  end if;
  if p_unit_price_cents is null or p_unit_price_cents < 0 then
    raise exception 'Escribe el precio de venta' using errcode = 'P0001';
  end if;
  if p_unit_price_cents > 10000000 then
    raise exception 'Revisa el precio: el máximo es Bs 100.000 por unidad' using errcode = 'P0001';
  end if;

  select * into v_product from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Ese producto ya no existe' using errcode = 'P0001';
  end if;

  -- Nunca se vende una unidad apartada por un pedido web.
  if v_product.stock < p_quantity then
    select o.number, o.status, o.status_changed_at into v_hold
    from public.order_items i
    join public.orders o on o.id = i.order_id
    where i.product_id = p_product_id
      and o.status in ('esperando_pago', 'en_revision', 'rechazado', 'pagado', 'listo_para_recoger')
    order by (o.status = 'esperando_pago') desc, o.status_changed_at
    limit 1;
    if found then
      raise exception '«%»: las unidades que faltan están apartadas por el pedido #%',
        v_product.name,
        lpad(v_hold.number::text, 4, '0') ||
        case when v_hold.status = 'esperando_pago'
          then ' (vence a las ' || to_char((v_hold.status_changed_at + interval '60 minutes') at time zone 'America/La_Paz', 'HH24:MI') || ')'
          else '' end
        using errcode = 'P0001';
    end if;
    raise exception 'El stock registrado no alcanza (quedan % disponibles). Corrige el stock primero', v_product.stock
      using errcode = 'P0001';
  end if;

  begin
    insert into public.manual_sales (product_id, quantity, unit_price_cents, channel, note, created_by, request_id)
    values (p_product_id, p_quantity, p_unit_price_cents, p_channel, nullif(trim(p_note), ''), auth.uid(), p_request_id)
    returning id into v_sale_id;
  exception when unique_violation then
    -- El mismo envío llegó dos veces a la vez: devolver la venta que ya quedó.
    select s.id into v_sale_id from public.manual_sales s where s.request_id = p_request_id;
    return v_sale_id;
  end;

  perform public.set_stock_reason('venta_manual', v_sale_id);
  update public.products p set stock = p.stock - p_quantity where p.id = p_product_id;
  perform public.set_stock_reason('');
  return v_sale_id;
end;
$$;
revoke execute on function public.admin_record_manual_sale(uuid, int, text, int, text, uuid) from public, anon;
grant execute on function public.admin_record_manual_sale(uuid, int, text, int, text, uuid) to authenticated;

-- 3) Resumen: cantidad × precio en bigint (un precio mal escrito no tumba la portada).
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
    select s.quantity::bigint * s.unit_price_cents as cents, (s.created_at at time zone 'America/La_Paz')::date as day
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
