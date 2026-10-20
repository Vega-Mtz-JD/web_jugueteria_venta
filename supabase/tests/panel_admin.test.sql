-- Funciones del panel: estados de pedido, administradores, borrar producto y resumen (plan 3A, tarea 2).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
delete from public.manual_sales;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000bb', 'b@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'customer';
update public.profiles set role = 'admin', full_name = 'Dueño' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-0000000000f1', 'Juego diez', 't-a10', '00000000-0000-0000-0000-0000000000ca', 1000, 10),
  ('00000000-0000-0000-0000-0000000000f2', 'Juego nuevo', 't-a2', '00000000-0000-0000-0000-0000000000ca', 1000, 2);

create function pg_temp.stock() returns int language sql as $$ select stock from public.products where slug = 't-a10' $$;
create function pg_temp.status(o text) returns text language sql as $$ select status::text from public.orders where id = current_setting(o)::uuid $$;
create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.entrega(m text) returns jsonb language sql as $$
  select case m
    when 'recojo' then '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}'::jsonb
    when 'encomienda' then '{"method":"encomienda","recipient_name":"Ana","phone":"71234567","recipient_ci":"123456","department":"Oruro","city":"Oruro"}'::jsonb
    else jsonb_build_object('method', 'envio_ciudad', 'recipient_name', 'Ana', 'phone', '71234567', 'address', 'Calle 1',
      'zone_id', (select id from public.delivery_zones where name = 'Sopocachi'))
  end
$$;
-- Crea un pedido como cliente y lo deja en el estado pedido (como postgres).
create function pg_temp.pedido(k text, m text, st text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform set_config(k, (select order_id::text from public.create_order(gen_random_uuid(),
    '[{"product_id":"00000000-0000-0000-0000-0000000000f1","quantity":1}]', pg_temp.entrega(m), '{"requested":false}')), true);
  perform pg_temp.as_postgres();
  if st <> 'esperando_pago' then
    update public.orders set status = st::public.order_status where id = current_setting(k)::uuid;
  end if;
end $$;
create function pg_temp.mover(k text, desde text, hacia text, motivo text default null, agencia text default null, guia text default null)
returns void language sql as $$
  select public.admin_set_order_status(current_setting(k)::uuid, desde::public.order_status, hacia::public.order_status, motivo, agencia, guia, null)
$$;

-- Transiciones --------------------------------------------------------------------------------------
select pg_temp.pedido('t.o1', 'recojo', 'en_revision');
select pg_temp.pedido('t.o2', 'encomienda', 'en_revision');
select pg_temp.pedido('t.o3', 'encomienda', 'en_revision');
select pg_temp.pedido('t.o4', 'envio', 'pagado');
select pg_temp.pedido('t.o5', 'recojo', 'esperando_pago');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');

select lives_ok($$select pg_temp.mover('t.o1', 'en_revision', 'pagado')$$, 'confirmar pago');
select throws_like($$select pg_temp.mover('t.o1', 'pagado', 'enviado')$$, 'No se puede pasar de «Pagado» a «Enviado»', 'un pedido para recoger no se envía');
select lives_ok($$select pg_temp.mover('t.o1', 'pagado', 'listo_para_recoger')$$, 'listo para recoger');
select lives_ok($$select pg_temp.mover('t.o1', 'listo_para_recoger', 'entregado')$$, 'entregado');
select is(pg_temp.status('t.o1'), 'entregado', 'el pedido para recoger llegó a entregado');

select throws_like($$select pg_temp.mover('t.o2', 'en_revision', 'rechazado', '  ')$$, 'Escribe el motivo del rechazo', 'rechazar pide motivo');
select lives_ok($$select pg_temp.mover('t.o2', 'en_revision', 'rechazado', 'Monto incorrecto')$$, 'rechazar con motivo');
select is((select rejection_reason from public.orders where id = current_setting('t.o2')::uuid), 'Monto incorrecto', 'el motivo queda en el pedido');
select is((select actor || ' / ' || note from public.order_events where order_id = current_setting('t.o2')::uuid and to_status = 'rechazado'),
  'admin / Monto incorrecto', 'el evento dice que fue el admin y el motivo');
select is(pg_temp.stock(), 5, 'antes de cancelar hay 5 (5 pedidos de 1)');
select lives_ok($$select pg_temp.mover('t.o2', 'rechazado', 'cancelado')$$, 'cancelar un rechazado');
select is(pg_temp.stock(), 6, 'cancelar devuelve el stock');

select lives_ok($$select pg_temp.mover('t.o3', 'en_revision', 'pagado')$$, 'confirmar pago de encomienda');
select throws_like($$select pg_temp.mover('t.o3', 'pagado', 'rechazado', 'x')$$, 'No se puede pasar de «Pagado» a «Rechazado»', 'transición inválida');
select throws_like($$select pg_temp.mover('t.o3', 'pagado', 'enviado', null, 'Trans Copacabana')$$, 'Escribe la agencia y el número de guía', 'encomienda pide guía');
select lives_ok($$select pg_temp.mover('t.o3', 'pagado', 'enviado', null, 'Trans Copacabana', 'G-123')$$, 'enviar encomienda');
select is((select shipping_agency || ' ' || tracking_code from public.orders where id = current_setting('t.o3')::uuid), 'Trans Copacabana G-123', 'agencia y guía guardadas');
select is((select note from public.order_events where order_id = current_setting('t.o3')::uuid and to_status = 'enviado'), 'Trans Copacabana · guía G-123', 'la nota del envío');
select throws_like($$select pg_temp.mover('t.o3', 'pagado', 'entregado')$$, 'Este pedido ya cambió; recarga la página', 'estado esperado desactualizado');
select lives_ok($$select pg_temp.mover('t.o3', 'enviado', 'entregado')$$, 'encomienda entregada');

select lives_ok($$select pg_temp.mover('t.o4', 'pagado', 'reembolsado')$$, 'reembolsar');
select throws_like($$select pg_temp.mover('t.o4', 'pagado', 'reembolsado')$$, 'Este pedido ya cambió; recarga la página', 'el segundo reembolso falla');
select is(pg_temp.stock(), 7, 'el reembolso devolvió una sola unidad');

select lives_ok($$select pg_temp.mover('t.o5', 'esperando_pago', 'cancelado')$$, 'cancelar uno sin pagar');
select is(pg_temp.stock(), 8, 'y devuelve su unidad');
select throws_like($$select pg_temp.mover('t.o5', 'cancelado', 'pagado')$$, 'No se puede pasar de «Cancelado» a «Pagado»', 'un cancelado no revive');

-- Administradores ---------------------------------------------------------------------------------
select lives_ok($$select public.admin_set_admin('B@TEST.BO', true)$$, 'hacer admin por correo sin importar mayúsculas');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000bb'), 'admin', 'B es admin');
select is((select count(*)::int from public.admin_list_admins()), 2, 'la lista tiene dos administradores');
select is((select email from public.admin_list_admins() where full_name = 'Dueño'), 'admin@test.bo', 'la lista trae el correo');
select throws_like($$select public.admin_set_admin('admin@test.bo', false)$$, 'No puedes quitarte a ti mismo', 'nadie se quita a sí mismo');
select throws_like($$select public.admin_set_admin('nadie@test.bo', true)$$, 'Esa persona primero debe crear su cuenta en la tienda', 'correo sin cuenta');
select lives_ok($$select public.admin_set_admin('b@test.bo', false)$$, 'quitar a otro administrador');
select is((select role from public.profiles where id = '00000000-0000-0000-0000-0000000000bb'), 'customer', 'B vuelve a ser cliente');

-- Borrar producto -----------------------------------------------------------------------------------
select is(public.admin_delete_product('00000000-0000-0000-0000-0000000000f1'), 'oculto', 'un producto vendido se oculta');
select is((select is_active from public.products where id = '00000000-0000-0000-0000-0000000000f1'), false, 'queda oculto');
select is(public.admin_delete_product('00000000-0000-0000-0000-0000000000f2'), 'borrado', 'un producto sin ventas se borra');
select is((select count(*)::int from public.products where id = '00000000-0000-0000-0000-0000000000f2'), 0, 'ya no existe');

-- Resumen de la portada -------------------------------------------------------------------------------
select pg_temp.as_postgres();
delete from public.orders;
update public.products set is_active = true where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.pedido('t.d1', 'envio', 'en_revision');
select pg_temp.pedido('t.d2', 'recojo', 'en_revision');
update public.orders set status_changed_at = now() - interval '25 hours' where id = current_setting('t.d2')::uuid;
select pg_temp.pedido('t.d3', 'recojo', 'en_revision');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select pg_temp.mover('t.d1', 'en_revision', 'pagado');
select pg_temp.mover('t.d3', 'en_revision', 'pagado');
select pg_temp.mover('t.d3', 'pagado', 'reembolsado');
select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f1', 1, 'tienda', 500, null);
select set_config('t.sum', public.admin_dashboard_summary()::text, true);
select is(current_setting('t.sum')::jsonb -> 'salesToday', '{"cents": 1500, "count": 2}'::jsonb, 'ventas de hoy: productos del pedido pagado + venta en tienda');
select is(current_setting('t.sum')::jsonb -> 'salesMonth', '{"cents": 1500, "count": 2}'::jsonb, 'ventas del mes');
select is((current_setting('t.sum')::jsonb ->> 'shippingMonthCents')::int, 1500, 'envíos cobrados aparte');
select is((current_setting('t.sum')::jsonb ->> 'pendingReview')::int, 1, 'uno por revisar');
select is((current_setting('t.sum')::jsonb ->> 'pendingReviewOver24h')::int, 1, 'y lleva más de 24 horas');
select is((current_setting('t.sum')::jsonb ->> 'toDeliver')::int, 1, 'uno por entregar');
select ok(jsonb_typeof(current_setting('t.sum')::jsonb -> 'lowStock') = 'array' and (current_setting('t.sum')::jsonb ? 'outOfStock'), 'trae poco stock y agotados');

-- Contacto del cliente ------------------------------------------------------------------------------
select is((select email || ' ' || coalesce(phone, '-') from public.admin_customer_contact(current_setting('t.d1')::uuid)), 'cliente@test.bo -', 'el admin ve el correo del cliente del pedido');

-- Fotos de productos: solo imágenes comunes de hasta 5 MB ------------------------------------------
select pg_temp.as_postgres();
select is((select allowed_mime_types from storage.buckets where id = 'product-images'),
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'], 'el bucket de fotos no acepta SVG ni PDF');
select is((select file_size_limit from storage.buckets where id = 'product-images'), 5242880::bigint, 'fotos de hasta 5 MB');

-- Seguridad ----------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select pg_temp.mover('t.d1', 'pagado', 'entregado')$$, '42501', null, 'un cliente no cambia estados');
select throws_ok($$select public.admin_set_admin('cliente@test.bo', true)$$, '42501', null, 'un cliente no se hace admin');
select throws_ok($$select * from public.admin_list_admins()$$, '42501', null, 'un cliente no ve los administradores');
select throws_ok($$select public.admin_delete_product('00000000-0000-0000-0000-0000000000f1')$$, '42501', null, 'un cliente no borra productos');
select throws_ok($$select public.admin_dashboard_summary()$$, '42501', null, 'un cliente no ve el resumen');
select throws_ok(format($$select * from public.admin_customer_contact('%s')$$, current_setting('t.d1')), '42501', null, 'un cliente no ve contactos');

select * from finish();
rollback;
