-- Pendientes, se está agotando e inventario valorizado (plan 5, tarea 3).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
delete from public.manual_sales;
delete from public.purchase_payments;
delete from public.purchases;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
-- Todo lo que ya existe (semilla o restos de e2e) cuenta como ejemplo: el inventario parte de cero.
update public.products set is_sample = true;
-- P1 visible con costo; P2 visible sin costo; P3 oculto sin precio (costo de compra); P4 visible con compra; P5 agotado.
insert into public.products (id, name, slug, category_id, price_cents, stock, is_active) values
  ('00000000-0000-0000-0000-0000000000d1', 'Juego P1', 't-p1', '00000000-0000-0000-0000-0000000000ca', 5000, 5, true),
  ('00000000-0000-0000-0000-0000000000d2', 'Juego P2', 't-p2', '00000000-0000-0000-0000-0000000000ca', 4000, 2, true),
  ('00000000-0000-0000-0000-0000000000d3', 'Juego P3', 't-p3', '00000000-0000-0000-0000-0000000000ca', 0, 0, false),
  ('00000000-0000-0000-0000-0000000000d4', 'Juego P4', 't-p4', '00000000-0000-0000-0000-0000000000ca', 3000, 0, true),
  ('00000000-0000-0000-0000-0000000000d5', 'Juego P5', 't-p5', '00000000-0000-0000-0000-0000000000ca', 3000, 0, true);
insert into public.product_costs (product_id, initial_cost_cents) values ('00000000-0000-0000-0000-0000000000d1', 3000);
insert into public.suppliers (id, name, contact_name, whatsapp) values
  ('00000000-0000-0000-0000-0000000005b1', 'Proveedor Uno', 'Don Luis', '71111111');

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
create function pg_temp.pedido(product text, st text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  select order_id into v from public.create_order(gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 1)),
    '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":false}');
  perform pg_temp.as_postgres();
  if st <> 'esperando_pago' then
    update public.orders set status = 'en_revision' where id = v;
    if st <> 'en_revision' then update public.orders set status = st::public.order_status where id = v; end if;
  end if;
  return v;
end $$;
create function pg_temp.compra(product text, currency text, price int) returns uuid language sql as $$
  select public.admin_create_purchase(gen_random_uuid(), '00000000-0000-0000-0000-0000000005b1', current_date, currency, null,
    jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', 1, 'unit_price_cents', price)))
$$;
create function pg_temp.now_() returns jsonb language sql as $$ select public.admin_dashboard_now() $$;

-- Pedidos: uno pagado aparta 1 de P1; uno en revisión de un juego de ejemplo (UNO) --------------------------
select pg_temp.pedido('00000000-0000-0000-0000-0000000000d1', 'pagado');
select pg_temp.pedido((select id::text from public.products where slug = 'uno'), 'en_revision');
-- Los juegos de ejemplo no se muestran, así no compiten en "se está agotando".
update public.products set is_active = false where is_sample;
-- P2: 3 vendidas hace 5 días
insert into public.manual_sales (product_id, quantity, unit_price_cents, channel, created_by, created_at)
values ('00000000-0000-0000-0000-0000000000d2', 3, 4000, 'tienda', '00000000-0000-0000-0000-0000000000ad', now() - interval '5 days');

-- Compras: P3 y P4 recibidas (BOB, sin pagar); una en dólares encargada; una anulada -----------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select public.admin_receive_purchase(pg_temp.compra('00000000-0000-0000-0000-0000000000d3', 'BOB', 2500), '[]', 0, null);
select public.admin_receive_purchase(pg_temp.compra('00000000-0000-0000-0000-0000000000d4', 'BOB', 1000), '[]', 0, null);
select pg_temp.compra('00000000-0000-0000-0000-0000000000d5', 'USD', 1500);
select public.admin_void_purchase(pg_temp.compra('00000000-0000-0000-0000-0000000000d5', 'BOB', 9999));

-- Inventario ------------------------------------------------------------------------------------------------
select is((pg_temp.now_() -> 'inventory' ->> 'products')::int, 4, 'P1, P2, P3 y P4 tienen unidades (P5 no)');
select is((pg_temp.now_() -> 'inventory' ->> 'units')::int, 9, 'P1: 4 + 1 apartada; P2: 2; P3: 1; P4: 1');
select is((pg_temp.now_() -> 'inventory' ->> 'costValueCents')::bigint, 18500::bigint, 'a costo: 5 × 3000 + 2500 + 1000');
select is((pg_temp.now_() -> 'inventory' ->> 'saleValueCents')::bigint, 36000::bigint, 'a precio: 5 × 5000 + 2 × 4000 + 3000');
select is((pg_temp.now_() -> 'inventory' ->> 'potentialProfitCents')::bigint, 12000::bigint, 'si vende todo: 5 × 2000 + 2000');
select is(pg_temp.now_() -> 'inventory' -> 'withoutCost',
  '{"products": 1, "units": 2, "items": [{"productId": "00000000-0000-0000-0000-0000000000d2", "name": "Juego P2"}]}'::jsonb, 'P2 sin costo');
select is(pg_temp.now_() -> 'inventory' -> 'withoutPrice',
  '{"products": 1, "items": [{"productId": "00000000-0000-0000-0000-0000000000d3", "name": "Juego P3"}]}'::jsonb, 'P3 sin precio');
select pg_temp.as_postgres();
select set_config('t.samples', (select count(*) from public.products p where p.is_sample and p.stock + public.reserved_units_of(p.id) > 0)::text, true);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is((pg_temp.now_() -> 'inventory' ->> 'samplesWithStock')::int, current_setting('t.samples')::int,
  'los juegos de ejemplo con stock se cuentan aparte');
select ok(current_setting('t.samples')::int > 0, 'hay juegos de ejemplo con stock (semilla)');
select is((pg_temp.now_() -> 'inventory' ->> 'costValueCents')::bigint - 2500 - 1000,
  5 * (public.admin_product_cost_summary('00000000-0000-0000-0000-0000000000d1') ->> 'currentUnitCostCents')::bigint,
  'el valor a costo de P1 usa el costo vigente de su ficha');

-- Se está agotando ------------------------------------------------------------------------------------------
select is((select array_agg(i ->> 'name' order by n) from jsonb_array_elements(pg_temp.now_() -> 'runningLow' -> 'items') with ordinality x(i, n)),
  array['Juego P2', 'Juego P5', 'Juego P4'], 'primero lo que más se vende, luego el menor stock; P3 oculto no está');
select is((pg_temp.now_() -> 'runningLow' -> 'items' -> 0 ->> 'sold30d')::int, 3, 'P2: 3 vendidas en 30 días');
select is(pg_temp.now_() -> 'runningLow' -> 'items' -> 0 -> 'reorder', 'null'::jsonb, 'P2 nunca se compró');
select is(pg_temp.now_() -> 'runningLow' -> 'items' -> 2 -> 'reorder',
  '{"supplierName": "Proveedor Uno", "contactName": "Don Luis", "whatsapp": "71111111", "quantity": 1}'::jsonb,
  'P4: pedir de nuevo al último proveedor');
select is((pg_temp.now_() -> 'runningLow' ->> 'lowStockCount')::int, 2, 'visibles con 1 a 3: P2 y P4');
select is((pg_temp.now_() -> 'runningLow' ->> 'outOfStockCount')::int, 1, 'visibles agotados: P5');

-- Pendientes ------------------------------------------------------------------------------------------------
select is(pg_temp.now_() -> 'debt', '{"bobCents": 3500, "usdCents": 1500}'::jsonb, 'deuda por moneda; la anulada no suma');
select is((pg_temp.now_() ->> 'purchasesToArrive')::int, 1, 'una compra por llegar');
select is((pg_temp.now_() ->> 'pendingReview')::int, (public.admin_dashboard_summary() ->> 'pendingReview')::int, 'por revisar = portada A');
select is((pg_temp.now_() ->> 'pendingReview')::int, 1, 'un pedido por revisar');
select is((pg_temp.now_() ->> 'toDeliver')::int, (public.admin_dashboard_summary() ->> 'toDeliver')::int, 'por entregar = portada A');
select is((pg_temp.now_() ->> 'pendingReviewOver24h')::int, 0, 'ninguno lleva más de 24 h');

-- Seguridad -------------------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.admin_dashboard_now() $$, '42501', null, 'un cliente no ve el resumen');

select * from finish();
rollback;
