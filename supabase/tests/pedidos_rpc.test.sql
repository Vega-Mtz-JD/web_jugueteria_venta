-- Funciones de pedido: create_order, submit_payment_proof, cancel_order_by_customer, expire_orders.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Datos propios de la prueba (los pedidos de otras corridas se borran dentro de esta transacción)
delete from public.orders;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.bo'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.bo');
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000c1', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock, is_active) values
  ('00000000-0000-0000-0000-0000000000a5', 'Juego cinco', 't-p5', '00000000-0000-0000-0000-0000000000c1', 1000, 5, true),
  ('00000000-0000-0000-0000-0000000000a1', 'Jenga test', 't-p1', '00000000-0000-0000-0000-0000000000c1', 2000, 1, true),
  ('00000000-0000-0000-0000-0000000000a3', 'Juego tres', 't-p3', '00000000-0000-0000-0000-0000000000c1', 500, 3, true),
  ('00000000-0000-0000-0000-0000000000a0', 'Juego oculto', 't-px', '00000000-0000-0000-0000-0000000000c1', 700, 9, false);

create function pg_temp.stock(p text) returns int language sql as $$ select stock from public.products where slug = p $$;
create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.recojo() returns jsonb language sql as $$ select '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}'::jsonb $$;
create function pg_temp.no_invoice() returns jsonb language sql as $$ select '{"requested":false}'::jsonb $$;

-- Crear pedido ----------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select set_config('t.o1', (select order_id::text from public.create_order(
  '00000000-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":2}]', pg_temp.recojo(), pg_temp.no_invoice())), true);
select is(pg_temp.stock('t-p5'), 3, 'crear pedido reserva el stock');
select is((select total_cents from public.orders where id = current_setting('t.o1')::uuid), 2000, 'total con el precio de la base');
select is((select status::text from public.orders where id = current_setting('t.o1')::uuid), 'esperando_pago', 'nace esperando el pago');
select ok((select number > 0 from public.orders where id = current_setting('t.o1')::uuid), 'tiene número de pedido');
select is(
  (select order_id::text from public.create_order('00000000-0000-0000-0000-000000000001', '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":2}]', pg_temp.recojo(), pg_temp.no_invoice())),
  current_setting('t.o1'), 'mismo request_id devuelve el mismo pedido'
);
select is(pg_temp.stock('t-p5'), 3, 'el reintento no descuenta stock dos veces');

-- La última unidad --------------------------------------------------------------------
select set_config('t.o2', (select order_id::text from public.create_order(
  '00000000-0000-0000-0000-000000000002', '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]', pg_temp.recojo(), pg_temp.no_invoice())), true);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_like(
  $$select * from public.create_order('00000000-0000-0000-0000-000000000003', '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1}]', pg_temp.recojo(), pg_temp.no_invoice())$$,
  'Ya no queda stock suficiente de «Jenga test»%', 'el segundo comprador de la última unidad recibe un mensaje claro'
);
select is(pg_temp.stock('t-p1'), 0, 'la última unidad no se vende dos veces');

-- Validaciones ----------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_like(
  $$select * from public.create_order(gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-0000000000a0","quantity":1}]', pg_temp.recojo(), pg_temp.no_invoice())$$,
  '«Juego oculto» ya no está disponible%', 'un producto inactivo no se puede comprar'
);
select set_config('t.o3', (select order_id::text from public.create_order(
  '00000000-0000-0000-0000-000000000004', '[{"product_id":"00000000-0000-0000-0000-0000000000a3","quantity":1,"unit_price_cents":1}]', pg_temp.recojo(), pg_temp.no_invoice())), true);
select is((select total_cents from public.orders where id = current_setting('t.o3')::uuid), 500, 'un precio enviado por el navegador se ignora');

select set_config('t.o4', (select order_id::text from public.create_order(
  '00000000-0000-0000-0000-000000000005', '[{"product_id":"00000000-0000-0000-0000-0000000000a3","quantity":1}]',
  jsonb_build_object('method','envio_ciudad','recipient_name','Ana','phone','71234567',
    'zone_id', (select id from public.delivery_zones where name = 'El Alto'),
    'meeting_point_id', (select id from public.meeting_points order by sort_order limit 1)),
  pg_temp.no_invoice())), true);
select is((select delivery_fee_cents from public.orders where id = current_setting('t.o4')::uuid), 0, 'punto de encuentro: tarifa Bs 0');
select throws_like(
  format($$select * from public.create_order(gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":1}]', '{"method":"envio_ciudad","recipient_name":"Ana","phone":"71234567","zone_id":"%s"}', '{"requested":false}')$$,
    (select id from public.delivery_zones where name = 'El Alto')),
  '%punto de encuentro%', 'zona de punto de encuentro exige el punto'
);
select set_config('t.o5', (select order_id::text from public.create_order(
  '00000000-0000-0000-0000-000000000006', '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":1}]',
  jsonb_build_object('method','envio_ciudad','recipient_name','Ana','phone','71234567',
    'zone_id', (select id from public.delivery_zones where name = 'Sopocachi'), 'address', 'Calle 1 #23'),
  pg_temp.no_invoice())), true);
select is((select total_cents from public.orders where id = current_setting('t.o5')::uuid), 2500, 'domicilio: precio + Bs 15');
select throws_like(
  format($$select * from public.create_order(gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":1}]', '{"method":"envio_ciudad","recipient_name":"Ana","phone":"71234567","zone_id":"%s"}', '{"requested":false}')$$,
    (select id from public.delivery_zones where name = 'Sopocachi')),
  '%dirección%', 'domicilio exige la dirección'
);
select throws_like(
  $$select * from public.create_order(gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":1}]', '{"method":"encomienda","recipient_name":"Ana","phone":"71234567","department":"Cochabamba","city":"Quillacollo"}', '{"requested":false}')$$,
  '%CI%', 'la encomienda exige el CI de quien recoge'
);
select throws_like(
  $$select * from public.create_order(gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-0000000000a5","quantity":1}]', '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":true}')$$,
  '%NIT%', 'la factura exige NIT'
);
select is(pg_temp.stock('t-p5'), 2, 'los pedidos fallidos no tocan el stock');

-- Capturas de pago -------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select throws_ok(
  format($$select public.submit_payment_proof('%s', '00000000-0000-0000-0000-00000000000b/%s/x.webp')$$, current_setting('t.o1'), current_setting('t.o1')),
  'P0001', null, 'B no puede pagar el pedido de A'
);
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$select public.submit_payment_proof('%s', '00000000-0000-0000-0000-00000000000a/otro/x.webp')$$, current_setting('t.o1')),
  'P0001', null, 'la ruta debe ser la carpeta del pedido'
);
insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-00000000000a/' || current_setting('t.o1') || '/1.webp');
select lives_ok(
  format($$select public.submit_payment_proof('%1$s', '00000000-0000-0000-0000-00000000000a/%1$s/1.webp')$$, current_setting('t.o1')),
  'A envía su captura'
);
select is((select status::text from public.orders where id = current_setting('t.o1')::uuid), 'en_revision', 'con captura pasa a En revisión');
select ok((select submitted_at is not null from public.orders where id = current_setting('t.o1')::uuid), 'queda la fecha de envío');

select pg_temp.as_admin();
update public.orders set status = 'pagado' where id = current_setting('t.o2')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_ok(
  format($$select public.submit_payment_proof('%1$s', '00000000-0000-0000-0000-00000000000a/%1$s/1.webp')$$, current_setting('t.o2')),
  'P0001', null, 'un pedido pagado no acepta capturas'
);

select pg_temp.as_admin();
update public.orders set status = 'rechazado', rejection_reason = 'Monto incorrecto' where id = current_setting('t.o1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('payment-proofs', '00000000-0000-0000-0000-00000000000a/' || current_setting('t.o1') || '/2.webp');
select lives_ok(
  format($$select public.submit_payment_proof('%1$s', '00000000-0000-0000-0000-00000000000a/%1$s/2.webp')$$, current_setting('t.o1')),
  'tras un rechazo se puede subir otra captura'
);
select is((select count(*)::int from public.payment_proofs where order_id = current_setting('t.o1')::uuid), 2, 'se guardan todas las capturas');
select ok((select rejection_reason is null and status = 'en_revision' from public.orders where id = current_setting('t.o1')::uuid), 'vuelve a En revisión sin motivo de rechazo');

-- Cancelar -------------------------------------------------------------------------------------
select throws_ok(format($$select public.cancel_order_by_customer('%s')$$, current_setting('t.o1')), 'P0001', null, 'en revisión el cliente no puede cancelar');
select pg_temp.as_admin();
update public.orders set status = 'rechazado' where id = current_setting('t.o1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select lives_ok(format($$select public.cancel_order_by_customer('%s')$$, current_setting('t.o1')), 'rechazado: el cliente puede cancelar');
select is(pg_temp.stock('t-p5'), 4, 'cancelar devuelve el stock');
select ok(
  (select count(*) >= 4 from public.order_events where order_id = current_setting('t.o1')::uuid),
  'cada cambio de estado queda registrado'
);

-- Vencimiento -------------------------------------------------------------------------------------
select pg_temp.as_admin();
update public.orders set status = 'rechazado' where id = current_setting('t.o3')::uuid;
update public.orders set status = 'en_revision' where id = current_setting('t.o2')::uuid;
select is(public.expire_orders(now() + interval '61 minutes'), 2, 'vence los pedidos sin pago después de 60 minutos');
select is(pg_temp.stock('t-p3'), 2, 'el vencimiento devuelve el stock');
select is(public.expire_orders(now() + interval '47 hours'), 0, 'un rechazado no vence antes de 48 horas');
select is(public.expire_orders(now() + interval '49 hours'), 1, 'un rechazado vence a las 48 horas');
select is((select status::text from public.orders where id = current_setting('t.o3')::uuid), 'cancelado', 'el rechazado vencido queda cancelado');
select is(public.expire_orders(now() + interval '1000 hours'), 0, 'en revisión nunca vence');
select is((select count(*)::int from cron.job where jobname = 'vencer-pedidos'), 1, 'el vencimiento está programado');

-- Borrar productos de prueba cuando alguno ya se vendió -------------------------------------
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
update public.products set is_sample = true where slug in ('t-p5', 't-p3');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select lives_ok($$select public.delete_sample_products()$$, 'borrar productos de prueba funciona aunque alguno tenga pedidos');
select pg_temp.as_admin();
select is((select is_active from public.products where slug = 't-p5'), false, 'un producto de prueba con pedidos se oculta en vez de borrarse');
select is((select count(*)::int from public.order_items where product_id = '00000000-0000-0000-0000-0000000000a5') > 0, true, 'los pedidos conservan sus productos');

-- Mismo producto con el id en distinto caso (llamada directa a la API) ---------------------
select pg_temp.as_admin();
update public.products set stock = 20 where slug = 't-p1';
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select throws_like(
  $$select * from public.create_order(gen_random_uuid(), '[{"product_id":"00000000-0000-0000-0000-0000000000a1","quantity":1},{"product_id":"00000000-0000-0000-0000-0000000000A1","quantity":20}]', pg_temp.recojo(), pg_temp.no_invoice())$$,
  '%repetidos%', 'el mismo producto con el id en mayúsculas cuenta como repetido'
);
select is(pg_temp.stock('t-p1'), 20, 'ese intento no toca el stock');

select * from finish();
rollback;
