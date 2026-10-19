-- Historial de stock, ventas manuales y conteo de estante (spec del panel §5.3–§5.4).
-- Cada cambio de `products.stock` deja una fila en `stock_movements` (trigger). Quien cambia el
-- stock dice el motivo con set_config('app.stock_reason' / 'app.stock_ref' / 'app.stock_note').

create table public.stock_movements (
  id bigint generated always as identity primary key,
  product_id uuid not null references public.products (id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('alta', 'venta_web', 'devolucion_web', 'venta_manual', 'anulacion_venta_manual', 'ajuste', 'compra')),
  ref_id uuid,
  actor uuid,
  note text,
  created_at timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

alter table public.stock_movements enable row level security;
create policy "historial de stock: admin lee" on public.stock_movements
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.stock_movements from anon, authenticated;

create or replace function public.log_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_delta int := new.stock - coalesce(case when tg_op = 'UPDATE' then old.stock end, 0);
begin
  if v_delta <> 0 then
    insert into public.stock_movements (product_id, delta, reason, ref_id, actor, note)
    values (
      new.id,
      v_delta,
      coalesce(nullif(current_setting('app.stock_reason', true), ''), case when tg_op = 'INSERT' then 'alta' else 'ajuste' end),
      nullif(current_setting('app.stock_ref', true), '')::uuid,
      auth.uid(),
      nullif(current_setting('app.stock_note', true), '')
    );
  end if;
  return new;
end;
$$;

create trigger products_log_stock
  after insert or update of stock on public.products
  for each row execute function public.log_stock_movement();

-- Los productos que ya existían empiezan el historial con su stock actual (así la suma cuadra).
insert into public.stock_movements (product_id, delta, reason, note)
select id, stock, 'alta', 'Stock al empezar el historial' from public.products where stock <> 0;

-- Fija el motivo de los próximos cambios de stock en esta transacción ('' lo limpia).
create or replace function public.set_stock_reason(p_reason text, p_ref uuid default null, p_note text default null)
returns void
language sql
set search_path = ''
as $$
  select set_config('app.stock_reason', coalesce(p_reason, ''), true),
         set_config('app.stock_ref', coalesce(p_ref::text, ''), true),
         set_config('app.stock_note', coalesce(p_note, ''), true);
$$;
revoke execute on function public.set_stock_reason(text, uuid, text) from public, anon, authenticated;

-- Pedido web: igual que en 20261019000005, pero el descuento queda como venta_web del pedido.
create or replace function public.create_order(p_request_id uuid, p_items jsonb, p_delivery jsonb, p_invoice jsonb)
returns table (order_id uuid, order_number int)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := auth.uid();
  v_existing public.orders%rowtype;
  v_settings public.store_settings%rowtype;
  v_method public.delivery_method;
  v_zone public.delivery_zones%rowtype;
  v_product public.products%rowtype;
  v_item record;
  v_subtotal int := 0;
  v_fee int := 0;
  v_order public.orders%rowtype;
  v_name text := nullif(trim(p_delivery ->> 'recipient_name'), '');
  v_phone text := nullif(trim(p_delivery ->> 'phone'), '');
  v_address text := nullif(trim(p_delivery ->> 'address'), '');
  v_reference text := nullif(trim(p_delivery ->> 'address_reference'), '');
  v_point_id uuid;
  v_point_custom text := nullif(trim(p_delivery ->> 'meeting_point_custom'), '');
  v_ci text := nullif(trim(p_delivery ->> 'recipient_ci'), '');
  v_department text := nullif(trim(p_delivery ->> 'department'), '');
  v_city text := nullif(trim(p_delivery ->> 'city'), '');
  v_invoice boolean := coalesce((p_invoice ->> 'requested')::boolean, false);
  v_nit text := nullif(trim(p_invoice ->> 'nit'), '');
  v_invoice_name text := nullif(trim(p_invoice ->> 'name'), '');
begin
  if v_uid is null then
    raise exception 'Inicia sesión para comprar' using errcode = 'P0001';
  end if;

  -- Reintento del mismo envío (doble toque, volver atrás): devolver el mismo pedido.
  select * into v_existing from public.orders o where o.request_id = p_request_id;
  if found then
    if v_existing.customer_id <> v_uid then
      raise exception 'No pudimos crear el pedido, vuelve a intentarlo' using errcode = 'P0001';
    end if;
    return query select v_existing.id, v_existing.number;
    return;
  end if;

  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Tu carrito está vacío' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 30 then
    raise exception 'Un pedido puede tener hasta 30 productos distintos' using errcode = 'P0001';
  end if;
  -- Se compara como uuid, no como texto: 'abc…' y 'ABC…' son el mismo producto.
  if (select count(distinct (e ->> 'product_id')::uuid) from jsonb_array_elements(p_items) e) <> jsonb_array_length(p_items) then
    raise exception 'Hay productos repetidos en el carrito' using errcode = 'P0001';
  end if;
  if v_name is null then
    raise exception 'Escribe el nombre de quien recibe el pedido' using errcode = 'P0001';
  end if;
  if v_phone is null then
    raise exception 'Escribe un celular de contacto' using errcode = 'P0001';
  end if;

  begin
    v_method := (p_delivery ->> 'method')::public.delivery_method;
  exception when invalid_text_representation then
    v_method := null;
  end;
  if v_method is null then
    raise exception 'Elige cómo quieres recibir tu pedido' using errcode = 'P0001';
  end if;

  select * into v_settings from public.store_settings limit 1;

  if v_method = 'envio_ciudad' then
    select * into v_zone from public.delivery_zones z
    where z.id = nullif(p_delivery ->> 'zone_id', '')::uuid and z.is_active;
    if not found then
      raise exception 'Elige una zona de envío' using errcode = 'P0001';
    end if;
    if v_zone.mode = 'domicilio' then
      if v_address is null then
        raise exception 'Escribe la dirección de entrega' using errcode = 'P0001';
      end if;
      v_fee := coalesce(v_settings.delivery_fee_home_cents, 0);
    else
      select m.id into v_point_id from public.meeting_points m
      where m.id = nullif(p_delivery ->> 'meeting_point_id', '')::uuid and m.is_active;
      if v_point_id is null and v_point_custom is null then
        raise exception 'Elige un punto de encuentro o escribe uno' using errcode = 'P0001';
      end if;
      v_fee := coalesce(v_settings.delivery_fee_meeting_cents, 0);
    end if;
  elsif v_method = 'encomienda' then
    if v_ci is null then
      raise exception 'Falta el CI de quien recoge la encomienda' using errcode = 'P0001';
    end if;
    if v_department is null or v_department not in ('La Paz', 'Cochabamba', 'Santa Cruz', 'Oruro', 'Potosí', 'Chuquisaca', 'Tarija', 'Beni', 'Pando') then
      raise exception 'Elige el departamento de destino' using errcode = 'P0001';
    end if;
    if v_city is null then
      raise exception 'Escribe la ciudad de destino' using errcode = 'P0001';
    end if;
  end if;

  if v_invoice then
    if v_nit is null then
      raise exception 'Escribe el NIT o CI para la factura' using errcode = 'P0001';
    end if;
    if v_invoice_name is null then
      raise exception 'Escribe la razón social para la factura' using errcode = 'P0001';
    end if;
  end if;

  -- Productos: se bloquean en orden fijo para que dos compras simultáneas no se crucen.
  for v_item in
    select (e ->> 'product_id')::uuid as product_id, (e ->> 'quantity')::int as quantity
    from jsonb_array_elements(p_items) e
    order by 1
  loop
    if v_item.quantity is null or v_item.quantity < 1 or v_item.quantity > 20 then
      raise exception 'La cantidad de cada producto debe ser entre 1 y 20' using errcode = 'P0001';
    end if;
    select * into v_product from public.products p where p.id = v_item.product_id for update;
    if not found or not v_product.is_active then
      raise exception '«%» ya no está disponible', coalesce(v_product.name, 'Un producto') using errcode = 'P0001';
    end if;
    if v_product.stock < v_item.quantity then
      raise exception 'Ya no queda stock suficiente de «%» (quedan %)', v_product.name, v_product.stock using errcode = 'P0001';
    end if;
    v_subtotal := v_subtotal + v_product.price_cents * v_item.quantity;
  end loop;

  insert into public.orders (
    request_id, customer_id, delivery_method, zone_id, zone_mode, address, address_reference,
    meeting_point_id, meeting_point_custom, recipient_name, recipient_ci, phone, department, city,
    invoice_requested, invoice_nit, invoice_name, subtotal_cents, delivery_fee_cents, total_cents
  ) values (
    p_request_id, v_uid, v_method,
    case when v_method = 'envio_ciudad' then v_zone.id end,
    case when v_method = 'envio_ciudad' then v_zone.mode end,
    case when v_method = 'envio_ciudad' and v_zone.mode = 'domicilio' then v_address end,
    case when v_method = 'envio_ciudad' and v_zone.mode = 'domicilio' then v_reference end,
    case when v_method = 'envio_ciudad' and v_zone.mode = 'punto' then v_point_id end,
    case when v_method = 'envio_ciudad' and v_zone.mode = 'punto' and v_point_id is null then v_point_custom end,
    v_name,
    case when v_method = 'encomienda' then v_ci end,
    v_phone,
    case when v_method = 'encomienda' then v_department end,
    case when v_method = 'encomienda' then v_city end,
    v_invoice,
    case when v_invoice then v_nit end,
    case when v_invoice then v_invoice_name end,
    v_subtotal, v_fee, v_subtotal + v_fee
  )
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, unit_price_cents, quantity)
  select v_order.id, p.id, p.name, p.price_cents, (e ->> 'quantity')::int
  from jsonb_array_elements(p_items) e
  join public.products p on p.id = (e ->> 'product_id')::uuid;

  perform public.set_stock_reason('venta_web', v_order.id);
  update public.products p
  set stock = p.stock - (e ->> 'quantity')::int
  from jsonb_array_elements(p_items) e
  where p.id = (e ->> 'product_id')::uuid;

  perform public.set_stock_reason('');
  insert into public.order_events (order_id, to_status, actor, note)
  values (v_order.id, 'esperando_pago', 'cliente', 'Pedido creado');

  return query select v_order.id, v_order.number;
end;
$$;

-- Devolución de un pedido web (cancelado o vencido): devolucion_web con la referencia del pedido.
create or replace function public.restock_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.set_stock_reason('devolucion_web', p_order_id);
  update public.products p
  set stock = p.stock + i.quantity
  from (
    select product_id, sum(quantity)::int as quantity
    from public.order_items
    where order_id = p_order_id
    group by product_id
  ) i
  where i.product_id = p.id;
  perform public.set_stock_reason('');
end;
$$;
revoke execute on function public.restock_order(uuid) from public, anon, authenticated;

-- Ventas fuera de la web (en la tienda o por WhatsApp) -------------------------------------
create table public.manual_sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  quantity int not null check (quantity between 1 and 100),
  unit_price_cents int not null check (unit_price_cents >= 0),
  channel text not null check (channel in ('tienda', 'whatsapp')),
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references public.profiles (id)
);
create index manual_sales_created_idx on public.manual_sales (created_at desc);
create index manual_sales_product_idx on public.manual_sales (product_id);

alter table public.manual_sales enable row level security;
create policy "ventas manuales: admin lee" on public.manual_sales
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.manual_sales from anon, authenticated;

-- Unidades apartadas: descontadas del stock por un pedido web pero todavía en la tienda.
-- (rechazado también: el comprador puede mandar otra captura durante 48 horas)
create or replace function public.reserved_units_of(p_product_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(i.quantity), 0)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where i.product_id = p_product_id
    and o.status in ('esperando_pago', 'en_revision', 'rechazado', 'pagado', 'listo_para_recoger');
$$;
revoke execute on function public.reserved_units_of(uuid) from public, anon, authenticated;

create or replace function public.require_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede hacer esto' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.require_admin() from public, anon;
grant execute on function public.require_admin() to authenticated;

create or replace function public.admin_reserved_units()
returns table (product_id uuid, quantity int)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
  select i.product_id, sum(i.quantity)::int
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where o.status in ('esperando_pago', 'en_revision', 'rechazado', 'pagado', 'listo_para_recoger')
  group by i.product_id;
end;
$$;

create or replace function public.admin_record_manual_sale(
  p_product_id uuid, p_quantity int, p_channel text, p_unit_price_cents int, p_note text default null
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
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then
    raise exception 'La cantidad debe ser entre 1 y 100' using errcode = 'P0001';
  end if;
  if p_channel is null or p_channel not in ('tienda', 'whatsapp') then
    raise exception 'Elige dónde se vendió: en la tienda o por WhatsApp' using errcode = 'P0001';
  end if;
  if p_unit_price_cents is null or p_unit_price_cents < 0 then
    raise exception 'Escribe el precio de venta' using errcode = 'P0001';
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

  insert into public.manual_sales (product_id, quantity, unit_price_cents, channel, note, created_by)
  values (p_product_id, p_quantity, p_unit_price_cents, p_channel, nullif(trim(p_note), ''), auth.uid())
  returning id into v_sale_id;

  perform public.set_stock_reason('venta_manual', v_sale_id);
  update public.products p set stock = p.stock - p_quantity where p.id = p_product_id;
  perform public.set_stock_reason('');
  return v_sale_id;
end;
$$;

create or replace function public.admin_void_manual_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale public.manual_sales%rowtype;
begin
  perform public.require_admin();
  select * into v_sale from public.manual_sales s where s.id = p_sale_id for update;
  if not found then
    raise exception 'Esa venta no existe' using errcode = 'P0001';
  end if;
  if v_sale.voided_at is not null then
    raise exception 'Esta venta ya estaba anulada' using errcode = 'P0001';
  end if;
  update public.manual_sales s set voided_at = now(), voided_by = auth.uid() where s.id = p_sale_id;
  perform public.set_stock_reason('anulacion_venta_manual', p_sale_id);
  update public.products p set stock = p.stock + v_sale.quantity where p.id = v_sale.product_id;
  perform public.set_stock_reason('');
end;
$$;

-- "Contar estante": el dueño escribe cuántos hay y el sistema descuenta lo apartado.
create or replace function public.admin_count_shelf(p_product_id uuid, p_counted int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reserved int;
  v_stock int;
begin
  perform public.require_admin();
  if p_counted is null or p_counted < 0 then
    raise exception 'Escribe cuántas unidades contaste' using errcode = 'P0001';
  end if;
  perform 1 from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Ese producto ya no existe' using errcode = 'P0001';
  end if;
  v_reserved := public.reserved_units_of(p_product_id);
  if p_counted < v_reserved then
    raise exception 'Contaste menos de lo apartado en pedidos (%). Revisa los pedidos pendientes', v_reserved
      using errcode = 'P0001';
  end if;
  perform public.set_stock_reason('ajuste', null, 'Conteo de estante: ' || p_counted);
  update public.products p set stock = p_counted - v_reserved where p.id = p_product_id
  returning p.stock into v_stock;
  perform public.set_stock_reason('');
  return v_stock;
end;
$$;

create or replace function public.admin_adjust_stock(p_product_id uuid, p_delta int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock int;
begin
  perform public.require_admin();
  select p.stock into v_stock from public.products p where p.id = p_product_id for update;
  if not found then
    raise exception 'Ese producto ya no existe' using errcode = 'P0001';
  end if;
  if v_stock + coalesce(p_delta, 0) < 0 then
    raise exception 'El stock no puede quedar negativo' using errcode = 'P0001';
  end if;
  perform public.set_stock_reason('ajuste');
  update public.products p set stock = p.stock + coalesce(p_delta, 0) where p.id = p_product_id
  returning p.stock into v_stock;
  perform public.set_stock_reason('');
  return v_stock;
end;
$$;

revoke execute on function public.admin_reserved_units() from public, anon;
revoke execute on function public.admin_record_manual_sale(uuid, int, text, int, text) from public, anon;
revoke execute on function public.admin_void_manual_sale(uuid) from public, anon;
revoke execute on function public.admin_count_shelf(uuid, int) from public, anon;
revoke execute on function public.admin_adjust_stock(uuid, int) from public, anon;
grant execute on function public.admin_reserved_units() to authenticated;
grant execute on function public.admin_record_manual_sale(uuid, int, text, int, text) to authenticated;
grant execute on function public.admin_void_manual_sale(uuid) to authenticated;
grant execute on function public.admin_count_shelf(uuid, int) to authenticated;
grant execute on function public.admin_adjust_stock(uuid, int) to authenticated;
