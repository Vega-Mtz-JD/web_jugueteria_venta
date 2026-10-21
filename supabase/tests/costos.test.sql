-- Costo vigente, copia del costo en cada venta y ganancia por producto (plan 3B, tarea 3).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-00000000000c', 'K', 't-pk', '00000000-0000-0000-0000-0000000000ca', 6000, 5);
insert into public.suppliers (id, name) values ('00000000-0000-0000-0000-0000000005b1', 'Proveedor Uno');

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
-- product_current_cost no está abierta a ningún usuario (expondría costos): se lee por el resumen de admin.
create function pg_temp.costo() returns text language sql as $$
  select coalesce(r ->> 'currentUnitCostCents', 'null') || '/' || coalesce(r ->> 'costOrigin', 'null')
  from public.admin_product_cost_summary('00000000-0000-0000-0000-00000000000c') r
$$;
create function pg_temp.sold() returns jsonb language sql as $$
  select public.admin_product_cost_summary('00000000-0000-0000-0000-00000000000c') -> 'sold'
$$;
create function pg_temp.vender(price int) returns uuid language sql as $$
  select public.admin_record_manual_sale('00000000-0000-0000-0000-00000000000c', 1, 'tienda', price, null, gen_random_uuid())
$$;
-- Pedido web de 1 unidad, pagado (como postgres, igual que lo haría el panel)
create function pg_temp.pedido_pagado(k text) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform set_config(k, (select order_id::text from public.create_order(gen_random_uuid(),
    '[{"product_id":"00000000-0000-0000-0000-00000000000c","quantity":1}]',
    '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":false}')), true);
  perform pg_temp.as_postgres();
  update public.orders set status = 'en_revision' where id = current_setting(k)::uuid;
  update public.orders set status = 'pagado' where id = current_setting(k)::uuid;
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
end $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');

-- Sin compras ni costo inicial: sin costo, no se inventa ---------------------------------------------------
select is(pg_temp.costo(), 'null/null', 'sin compras ni costo inicial no hay costo');
select set_config('t.v1', pg_temp.vender(5000)::text, true);
select is((select unit_cost_cents from public.sale_costs where manual_sale_id = current_setting('t.v1')::uuid), null::int, 'la venta queda sin costo');
select is((pg_temp.sold() ->> 'unitsWithoutCost')::int, 1, 'y se cuenta aparte');

-- Costo de lo que ya tenía ----------------------------------------------------------------------------------
select public.admin_set_initial_cost('00000000-0000-0000-0000-00000000000c', 3000);
select is(pg_temp.costo(), '3000/inicial', 'usa el costo de lo que ya tenía');
select pg_temp.vender(5000);
select is((pg_temp.sold() ->> 'profitCents')::int, 2000, 'ganancia 50 − 30');

-- Compra recibida: manda la última compra ---------------------------------------------------------------------
select set_config('t.c1', public.admin_create_purchase(gen_random_uuid(), '00000000-0000-0000-0000-0000000005b1', current_date, 'BOB', null,
  '[{"product_id":"00000000-0000-0000-0000-00000000000c","quantity":2,"unit_price_cents":4000}]')::text, true);
select public.admin_receive_purchase(current_setting('t.c1')::uuid, null, 200, null);
select is(pg_temp.costo(), '4100/compra', '2 × 40 + 2 de envío = 41 cada uno');
select pg_temp.pedido_pagado('t.o1');
select is((select unit_cost_cents || '/' || cost_origin from public.sale_costs where source = 'web'), '4100/compra', 'el pago confirmado copia el costo');
select is((pg_temp.sold() ->> 'profitCents')::int, 3900, 'ganancia 20 + (60 − 41)');

-- Una compra posterior más cara no cambia lo ya ganado ----------------------------------------------------------
select set_config('t.c2', public.admin_create_purchase(gen_random_uuid(), '00000000-0000-0000-0000-0000000005b1', current_date, 'BOB', null,
  '[{"product_id":"00000000-0000-0000-0000-00000000000c","quantity":1,"unit_price_cents":9000}]')::text, true);
select public.admin_receive_purchase(current_setting('t.c2')::uuid, null, 0, null);
select is(pg_temp.costo(), '9000/compra', 'el costo vigente sube');
select is((pg_temp.sold() ->> 'profitCents')::int, 3900, 'pero la ganancia ya registrada no cambia');
select is((public.admin_product_cost_summary('00000000-0000-0000-0000-00000000000c') ->> 'averageUnitCostCents')::int, 5733, 'promedio de compras: (82 + 90) / 3');
select is(public.admin_product_cost_summary('00000000-0000-0000-0000-00000000000c') -> 'lastPurchase' ->> 'supplierName', 'Proveedor Uno', 'última compra: proveedor');

-- Reembolsos y ventas anuladas no cuentan ------------------------------------------------------------------------
select pg_temp.pedido_pagado('t.o2');
select pg_temp.as_postgres();
update public.orders set status = 'reembolsado' where id = current_setting('t.o2')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select public.admin_void_manual_sale(current_setting('t.v1')::uuid);
select is(pg_temp.sold(), '{"units": 2, "unitsWithoutCost": 0, "revenueCents": 11000, "profitCents": 3900}'::jsonb,
  'cuentan solo la venta en tienda con costo y el pedido pagado');

-- Seguridad ---------------------------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.sale_costs) + (select count(*)::int from public.product_costs), 0, 'un cliente no ve costos');
select throws_ok($$select public.admin_set_initial_cost('00000000-0000-0000-0000-00000000000c', 1)$$, '42501', null, 'un cliente no pone costos');
select throws_ok($$select public.admin_product_cost_summary('00000000-0000-0000-0000-00000000000c')$$, '42501', null, 'un cliente no ve el resumen');
select throws_ok($$select * from public.product_current_cost('00000000-0000-0000-0000-00000000000c')$$, '42501', null, 'ni el costo vigente');

select * from finish();
rollback;
