-- Una sola definición de venta y la lista de ventas (plan 5, tarea 1).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
delete from public.manual_sales;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-00000000000a', 'Juego A', 't-pa', '00000000-0000-0000-0000-0000000000ca', 5000, 50),
  ('00000000-0000-0000-0000-00000000000b', 'Juego B', 't-pb', '00000000-0000-0000-0000-0000000000ca', 2000, 50);
insert into public.product_costs (product_id, initial_cost_cents) values ('00000000-0000-0000-0000-00000000000a', 3000);

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
-- Pedido web pagado con A×1 y B×1; la fecha de venta es la del evento a 'pagado'.
create function pg_temp.pedido_pagado(k text, paid_at timestamptz) returns void language plpgsql as $$
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  perform set_config(k, (select order_id::text from public.create_order(gen_random_uuid(),
    '[{"product_id":"00000000-0000-0000-0000-00000000000a","quantity":1},{"product_id":"00000000-0000-0000-0000-00000000000b","quantity":1}]',
    '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":false}')), true);
  perform pg_temp.as_postgres();
  update public.orders set status = 'en_revision' where id = current_setting(k)::uuid;
  update public.orders set status = 'pagado' where id = current_setting(k)::uuid;
  update public.order_events set created_at = paid_at where order_id = current_setting(k)::uuid and to_status = 'pagado';
end $$;
create function pg_temp.manual(k text, product text, qty int, price int, channel text, at timestamptz) returns void language plpgsql as $$
begin
  perform pg_temp.as_postgres();
  insert into public.manual_sales (id, product_id, quantity, unit_price_cents, channel, created_by, created_at)
  values (gen_random_uuid(), product::uuid, qty, price, channel, '00000000-0000-0000-0000-0000000000ad', at)
  returning id::text into strict product;
  perform set_config(k, product, true);
end $$;
create function pg_temp.dia(d date, canal text default null, sin_costo boolean default false) returns jsonb language sql as $$
  select public.admin_sales_list(null, d, d, canal, sin_costo)
$$;
create function pg_temp.t(d date, campo text) returns bigint language sql as $$
  select (pg_temp.dia(d) -> 'totals' ->> campo)::bigint
$$;

-- Un pedido web (A con costo, B sin costo) y una venta en tienda, el mismo día ------------------------------
select pg_temp.pedido_pagado('t.o1', '2026-10-10 12:00-04');
select pg_temp.manual('t.m1', '00000000-0000-0000-0000-00000000000a', 2, 4500, 'tienda', '2026-10-10 15:00-04');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');

select is(pg_temp.t('2026-10-10', 'salesCents'), 16000::bigint, 'ventas del día: 5000 + 2000 + 9000');
select is(pg_temp.t('2026-10-10', 'count'), 2::bigint, 'un pedido y una venta manual son 2 ventas');
select is(pg_temp.t('2026-10-10', 'units'), 4::bigint, '4 juegos');
select is(pg_temp.t('2026-10-10', 'costCents'), 9000::bigint, 'costo de las líneas con costo: 3000 + 2 × 3000');
select is(pg_temp.t('2026-10-10', 'profitCents'), 5000::bigint, 'ganancia: (5000 − 3000) + 2 × (4500 − 3000)');
select is(pg_temp.t('2026-10-10', 'withoutCostCents'), 2000::bigint, 'B no tiene costo: va aparte');
select is(pg_temp.t('2026-10-10', 'withoutCostUnits'), 1::bigint, '1 juego sin costo');
select is(pg_temp.t('2026-10-10', 'salesCents'),
  pg_temp.t('2026-10-10', 'costCents') + pg_temp.t('2026-10-10', 'profitCents') + pg_temp.t('2026-10-10', 'withoutCostCents'),
  'ventas = costo + ganancia + sin costo');
select is((pg_temp.dia('2026-10-10') ->> 'rowCount')::int, 3, 'una fila por línea vendida');
select is(pg_temp.dia('2026-10-10') -> 'range', '{"from": "2026-10-10", "to": "2026-10-10"}'::jsonb, 'devuelve el rango');
select is((select count(*)::int from jsonb_array_elements(pg_temp.dia('2026-10-10') -> 'rows') r
           where r ->> 'channel' = 'web' and (r ->> 'orderNumber') is not null and r ->> 'orderId' = current_setting('t.o1')),
  2, 'las filas web traen el pedido y su número');
select is((select r -> 'profitCents' from jsonb_array_elements(pg_temp.dia('2026-10-10') -> 'rows') r
           where r ->> 'productName' = 'Juego B'), 'null'::jsonb, 'la fila sin costo no tiene ganancia');

-- Filtros ---------------------------------------------------------------------------------------------------
select is((pg_temp.dia('2026-10-10', 'tienda') -> 'totals' ->> 'salesCents')::int, 9000, 'canal tienda');
select is((pg_temp.dia('2026-10-10', 'tienda') -> 'totals' ->> 'count')::int, 1, 'canal tienda: 1 venta');
select is((pg_temp.dia('2026-10-10', null, true) ->> 'rowCount')::int, 1, 'solo sin costo: 1 fila');
select is((pg_temp.dia('2026-10-10', null, true) -> 'totals' ->> 'salesCents')::int, 2000, 'solo sin costo: 2000');

-- El envío no es venta y se cuenta una sola vez por pedido --------------------------------------------------
select pg_temp.as_postgres();
update public.orders set delivery_fee_cents = 1500, total_cents = subtotal_cents + 1500 where id = current_setting('t.o1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is(pg_temp.t('2026-10-10', 'shippingCents'), 1500::bigint, 'envío del pedido una sola vez');
select is(pg_temp.t('2026-10-10', 'salesCents'), 16000::bigint, 'el envío no suma a las ventas');

-- Medianoche de La Paz --------------------------------------------------------------------------------------
select pg_temp.manual('t.m2', '00000000-0000-0000-0000-00000000000b', 1, 2000, 'whatsapp', '2026-10-11 23:30-04');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is(pg_temp.t('2026-10-11', 'salesCents'), 2000::bigint, 'a las 23:30 de La Paz cuenta en ese día');
select is(pg_temp.t('2026-10-12', 'salesCents'), 0::bigint, 'y no en el siguiente (03:30 UTC)');

-- Reembolso y anulación sacan la venta ----------------------------------------------------------------------
select pg_temp.as_postgres();
update public.orders set status = 'reembolsado' where id = current_setting('t.o1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is(pg_temp.t('2026-10-10', 'salesCents'), 9000::bigint, 'un pedido reembolsado deja de ser venta');
select is(pg_temp.t('2026-10-10', 'count'), 1::bigint, 'y no cuenta como venta');
select pg_temp.as_postgres();
update public.manual_sales set voided_at = now() where id = current_setting('t.m1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is(pg_temp.t('2026-10-10', 'salesCents'), 0::bigint, 'una venta manual anulada deja de ser venta');

-- Igual que la portada de la etapa A (hoy y el mes) --------------------------------------------------------
select pg_temp.pedido_pagado('t.o2', now());
select pg_temp.manual('t.m3', '00000000-0000-0000-0000-00000000000a', 1, 5000, 'tienda', now());
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is((public.admin_sales_list('hoy') -> 'totals' ->> 'salesCents')::bigint,
  (public.admin_dashboard_summary() -> 'salesToday' ->> 'cents')::bigint, 'ventas de hoy = portada de la etapa A');
select is((public.admin_sales_list('hoy') -> 'totals' ->> 'count')::bigint,
  (public.admin_dashboard_summary() -> 'salesToday' ->> 'count')::bigint, 'cantidad de hoy = portada de la etapa A');
select is((public.admin_sales_list('mes') -> 'totals' ->> 'salesCents')::bigint,
  (public.admin_dashboard_summary() -> 'salesMonth' ->> 'cents')::bigint, 'ventas del mes = portada de la etapa A');
select is((public.admin_sales_list('mes') -> 'totals' ->> 'count')::bigint,
  (public.admin_dashboard_summary() -> 'salesMonth' ->> 'count')::bigint, 'cantidad del mes = portada de la etapa A');
select is((public.admin_sales_list('hoy') -> 'totals' ->> 'salesCents')::int, 12000, 'hoy: pedido 7000 + tienda 5000');

-- Límite de filas: los totales cubren todo ------------------------------------------------------------------
select is(jsonb_array_length(public.admin_sales_list('hoy', null, null, null, false, 2) -> 'rows'), 2, 'limita las filas');
select is((public.admin_sales_list('hoy', null, null, null, false, 2) ->> 'rowCount')::int, 3, 'pero cuenta todas');
select is((public.admin_sales_list('hoy', null, null, null, false, 2) -> 'totals' ->> 'salesCents')::int, 12000, 'y los totales son de todas');

-- Errores ---------------------------------------------------------------------------------------------------
select throws_ok($$ select public.admin_sales_list(null, '2026-10-12', '2026-10-10') $$, 'P0001', 'Revisa las fechas', 'fechas al revés');
select throws_ok($$ select public.admin_sales_list(null, null, null) $$, 'P0001', 'Revisa las fechas', 'sin período ni fechas');
select throws_ok($$ select public.admin_sales_list(null, '2020-01-01', '2026-10-10') $$, 'P0001', 'Revisa las fechas', 'más de 800 días');
select throws_ok($$ select public.admin_sales_list('hoy', null, null, 'feria') $$, 'P0001', 'Canal desconocido', 'canal desconocido');
select throws_ok($$ select * from public.dashboard_period('semana', now()) $$, '42501', null, 'dashboard_period es interna');
select pg_temp.as_postgres();
select throws_ok($$ select * from public.dashboard_period('semana', now()) $$, 'P0001', 'Período desconocido', 'período desconocido');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.admin_sales_list('hoy') $$, '42501', null, 'un cliente no ve las ventas');
select throws_ok($$ select * from public.sales_lines(now() - interval '1 day', now()) $$, '42501', null, 'sales_lines es interna');

select * from finish();
rollback;
