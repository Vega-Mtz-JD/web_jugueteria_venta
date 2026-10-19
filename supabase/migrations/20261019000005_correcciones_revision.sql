-- Correcciones de la revisión final del plan 2.

-- 1) Un mismo producto con el id escrito en otro caso contaba como dos productos distintos:
--    vendía de más y, al cancelar, devolvía stock que nunca se descontó.
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

  update public.products p
  set stock = p.stock - (e ->> 'quantity')::int
  from jsonb_array_elements(p_items) e
  where p.id = (e ->> 'product_id')::uuid;

  insert into public.order_events (order_id, to_status, actor, note)
  values (v_order.id, 'esperando_pago', 'cliente', 'Pedido creado');

  return query select v_order.id, v_order.number;
end;
$$;

-- Devolver stock agrupando por producto (aunque un pedido viejo tuviera filas repetidas).
create or replace function public.restock_order(p_order_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.products p
  set stock = p.stock + i.quantity
  from (
    select product_id, sum(quantity)::int as quantity
    from public.order_items
    where order_id = p_order_id
    group by product_id
  ) i
  where i.product_id = p.id;
$$;
revoke execute on function public.restock_order(uuid) from public, anon, authenticated;

-- 2) Las capturas solo pueden ser fotos o capturas de pantalla (no SVG, que puede llevar código).
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
where id = 'payment-proofs';
