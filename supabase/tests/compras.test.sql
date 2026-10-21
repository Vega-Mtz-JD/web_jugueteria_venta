-- Proveedores y compras: encargo, llegada, reparto del envío, corrección y anulación (plan 3B, tarea 1).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-00000000000a', 'A', 't-pa', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-00000000000b', 'B', 't-pb', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-00000000000c', 'C', 't-pc', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-00000000000d', 'D', 't-pd', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-00000000000e', 'E', 't-pe', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-00000000000f', 'F', 't-pf', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-000000000010', 'G', 't-pg', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-000000000011', 'H', 't-ph', '00000000-0000-0000-0000-0000000000ca', 20000, 0);
insert into public.suppliers (id, name, whatsapp) values ('00000000-0000-0000-0000-0000000005b1', 'Distribuidora Test', '71234567');

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
create function pg_temp.stock(p text) returns int language sql as $$ select stock from public.products where id = p::uuid $$;
create function pg_temp.item(pur text, prod text) returns uuid language sql as $$
  select id from public.purchase_items where purchase_id = current_setting(pur)::uuid and product_id = prod::uuid
$$;
-- Crea una compra y la deja en t.<k>
create function pg_temp.compra(k text, req text, cur text, lines jsonb) returns void language plpgsql as $$
begin
  perform set_config(k, public.admin_create_purchase(req::uuid, '00000000-0000-0000-0000-0000000005b1', current_date, cur, null, lines)::text, true);
end $$;
create function pg_temp.recibir(k text, received jsonb, shipping int, rate numeric default null) returns void language sql as $$
  select public.admin_receive_purchase(current_setting(k)::uuid, received, shipping, rate)
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');

-- Encargo -------------------------------------------------------------------------------------------
select pg_temp.compra('t.p1', '00000000-0000-0000-0000-000000000101', 'BOB',
  '[{"product_id":"00000000-0000-0000-0000-00000000000a","quantity":2,"unit_price_cents":10000},
    {"product_id":"00000000-0000-0000-0000-00000000000b","quantity":1,"unit_price_cents":5000}]');
select is((select status from public.purchases where id = current_setting('t.p1')::uuid), 'encargada', 'nace encargada');
select is((select total_cents from public.purchase_balances where id = current_setting('t.p1')::uuid), 25000::bigint, 'total = 2 × 100 + 1 × 50');
select is(pg_temp.stock('00000000-0000-0000-0000-00000000000a'), 0, 'encargar no sube el stock');
select is(public.admin_create_purchase('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-0000000005b1', current_date, 'BOB', null,
  '[{"product_id":"00000000-0000-0000-0000-00000000000a","quantity":2,"unit_price_cents":10000}]')::text, current_setting('t.p1'), 'el mismo envío devuelve la misma compra');
select is((select count(*)::int from public.purchases), 1, 'no hay una segunda compra');

-- Juego nuevo: oculto, precio 0, stock 0 ---------------------------------------------------------------
select pg_temp.compra('t.pn', '00000000-0000-0000-0000-000000000102', 'BOB',
  '[{"new_product":{"name":"Juego encargado","category_id":"00000000-0000-0000-0000-0000000000ca"},"quantity":3,"unit_price_cents":10000}]');
select is((select is_active::text || '/' || price_cents || '/' || stock from public.products where name = 'Juego encargado'), 'false/0/0', 'el juego nuevo nace oculto, sin precio y sin stock');
select is((select slug from public.products where name = 'Juego encargado'), 'juego-encargado', 'con su dirección web');
select pg_temp.as_postgres();
select throws_ok($$update public.products set is_active = true where name = 'Juego encargado'$$, '23514', null, 'no se puede mostrar sin precio');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');

-- Llegada y reparto del envío ------------------------------------------------------------------------------
select pg_temp.recibir('t.p1', jsonb_build_array(
  jsonb_build_object('item_id', pg_temp.item('t.p1', '00000000-0000-0000-0000-00000000000a'), 'quantity', 2),
  jsonb_build_object('item_id', pg_temp.item('t.p1', '00000000-0000-0000-0000-00000000000b'), 'quantity', 1)), 1000);
select is(pg_temp.stock('00000000-0000-0000-0000-00000000000a') || '/' || pg_temp.stock('00000000-0000-0000-0000-00000000000b'), '2/1', 'al llegar sube el stock');
select is((select count(*)::int from public.stock_movements where reason = 'compra' and ref_id = current_setting('t.p1')::uuid), 2, 'con movimientos de compra');
select is((select line_cost_cents from public.purchase_items where id = pg_temp.item('t.p1', '00000000-0000-0000-0000-00000000000a')), 20800::bigint, 'A: 200 + 8 de envío');
select is((select line_cost_cents from public.purchase_items where id = pg_temp.item('t.p1', '00000000-0000-0000-0000-00000000000b')), 5200::bigint, 'B: 50 + 2 de envío');
select throws_like($$select pg_temp.recibir('t.p1', '[]', 0)$$, 'Esta compra ya llegó', 'no llega dos veces');

select pg_temp.compra('t.p3', '00000000-0000-0000-0000-000000000103', 'BOB',
  '[{"product_id":"00000000-0000-0000-0000-00000000000c","quantity":1,"unit_price_cents":100},
    {"product_id":"00000000-0000-0000-0000-00000000000d","quantity":1,"unit_price_cents":100},
    {"product_id":"00000000-0000-0000-0000-00000000000e","quantity":1,"unit_price_cents":100}]');
select pg_temp.recibir('t.p3', (select jsonb_agg(jsonb_build_object('item_id', id, 'quantity', 1)) from public.purchase_items where purchase_id = current_setting('t.p3')::uuid), 100);
select is((select sum(line_cost_cents)::int from public.purchase_items where purchase_id = current_setting('t.p3')::uuid), 400, 'el envío se reparte sin perder centavos');
select is((select array_agg(line_cost_cents - 100 order by line_cost_cents) from public.purchase_items where purchase_id = current_setting('t.p3')::uuid), array[33, 33, 34]::bigint[], 'por el resto mayor');

-- Corregir la llegada cuando ya se vendió ---------------------------------------------------------------
select pg_temp.compra('t.pf', '00000000-0000-0000-0000-000000000104', 'BOB', '[{"product_id":"00000000-0000-0000-0000-00000000000f","quantity":5,"unit_price_cents":1000}]');
select pg_temp.recibir('t.pf', jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('t.pf', '00000000-0000-0000-0000-00000000000f'), 'quantity', 5)), 0);
select public.admin_record_manual_sale('00000000-0000-0000-0000-00000000000f', 4, 'tienda', 2000, null, gen_random_uuid());
select throws_like(format($$select public.admin_correct_arrival('%s', '[{"item_id":"%s","quantity":0}]', 0, null)$$, current_setting('t.pf'), pg_temp.item('t.pf', '00000000-0000-0000-0000-00000000000f')),
  'No alcanza el stock: ya se vendieron 4 de «F»', 'no se baja lo que ya se vendió');
select is(pg_temp.stock('00000000-0000-0000-0000-00000000000f'), 1, 'y el stock no cambia');
select lives_ok(format($$select public.admin_correct_arrival('%s', '[{"item_id":"%s","quantity":4}]', 500, null)$$, current_setting('t.pf'), pg_temp.item('t.pf', '00000000-0000-0000-0000-00000000000f')),
  'corregir a 4 sí alcanza');
select is(pg_temp.stock('00000000-0000-0000-0000-00000000000f'), 0, 'el stock baja 1');
select is((select line_cost_cents from public.purchase_items where id = pg_temp.item('t.pf', '00000000-0000-0000-0000-00000000000f')), 4500::bigint, 'y el costo se recalcula con el envío nuevo');
select throws_like(format($$select public.admin_update_purchase('%s', '00000000-0000-0000-0000-0000000005b1', current_date, 'BOB', null, '[]')$$, current_setting('t.pf')),
  'Solo se puede corregir una compra encargada', 'una compra recibida no se edita');
select throws_like(format($$select public.admin_correct_arrival('%s', '[]', 0, null)$$, current_setting('t.pn')),
  'Solo se puede corregir la llegada de una compra recibida', 'una encargada no tiene llegada que corregir');

-- Anular una compra recibida -----------------------------------------------------------------------------
select pg_temp.compra('t.pg', '00000000-0000-0000-0000-000000000105', 'BOB', '[{"product_id":"00000000-0000-0000-0000-000000000010","quantity":2,"unit_price_cents":1000}]');
select pg_temp.recibir('t.pg', jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('t.pg', '00000000-0000-0000-0000-000000000010'), 'quantity', 2)), 0);
select lives_ok(format($$select public.admin_void_purchase('%s')$$, current_setting('t.pg')), 'anular una compra recibida sin ventas');
select is(pg_temp.stock('00000000-0000-0000-0000-000000000010'), 0, 'el stock vuelve');
select is((select count(*)::int from public.stock_movements where reason = 'anulacion_compra' and ref_id = current_setting('t.pg')::uuid), 1, 'con su movimiento');
select is((select status from public.purchases where id = current_setting('t.pg')::uuid), 'anulada', 'queda anulada');
select is((select count(*)::int from public.purchase_balances where id = current_setting('t.pg')::uuid), 0, 'y no cuenta en los saldos');

-- Compra en dólares -------------------------------------------------------------------------------------------
select pg_temp.compra('t.pu', '00000000-0000-0000-0000-000000000106', 'USD', '[{"product_id":"00000000-0000-0000-0000-000000000011","quantity":10,"unit_price_cents":1000}]');
select throws_like(format($$select public.admin_receive_purchase('%s', '[{"item_id":"%s","quantity":10}]', 0, null)$$, current_setting('t.pu'), pg_temp.item('t.pu', '00000000-0000-0000-0000-000000000011')),
  'Anota a cuánto estaba el dólar', 'una compra en dólares pide el dólar');
select pg_temp.recibir('t.pu', jsonb_build_array(jsonb_build_object('item_id', pg_temp.item('t.pu', '00000000-0000-0000-0000-000000000011'), 'quantity', 10)), 0, 6.96);
select is((select line_cost_cents from public.purchase_items where id = pg_temp.item('t.pu', '00000000-0000-0000-0000-000000000011')), 69600::bigint, 'US$ 100 a 6,96 = Bs 696');

-- El historial cuadra con el stock --------------------------------------------------------------------------
select pg_temp.as_postgres();
select is((select count(*)::int from public.products p where p.slug like 't-p%' and p.stock <> (select coalesce(sum(delta), 0) from public.stock_movements m where m.product_id = p.id)),
  0, 'la suma de movimientos es el stock');

-- Seguridad ------------------------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.suppliers) + (select count(*)::int from public.purchases) + (select count(*)::int from public.purchase_items)
  + (select count(*)::int from public.purchase_payments) + (select count(*)::int from public.purchase_balances), 0, 'un cliente no ve proveedores ni compras');
select throws_ok($$select public.admin_create_purchase(gen_random_uuid(), '00000000-0000-0000-0000-0000000005b1', current_date, 'BOB', null, '[]')$$, '42501', null, 'un cliente no crea compras');
select throws_ok(format($$select public.admin_receive_purchase('%s', '[]', 0, null)$$, current_setting('t.pn')), '42501', null, 'un cliente no recibe compras');
select throws_ok(format($$select public.admin_void_purchase('%s')$$, current_setting('t.pn')), '42501', null, 'un cliente no anula compras');
select throws_ok(format($$select public.admin_correct_arrival('%s', '[]', 0, null)$$, current_setting('t.pf')), '42501', null, 'un cliente no corrige llegadas');
select throws_ok(format($$select public.admin_set_purchase_notes('%s', 'x', 'y')$$, current_setting('t.pf')), '42501', null, 'un cliente no edita notas');

select * from finish();
rollback;
