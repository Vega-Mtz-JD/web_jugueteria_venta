-- Ventas, ganancia, barras, clientes y pedidos por período (plan 5, tarea 2).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
delete from public.manual_sales;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test.bo'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test.bo'),
  ('00000000-0000-0000-0000-0000000000c3', 'c3@test.bo');
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
-- Pedido de A×1 y B×1 de un cliente, creado en `at` y dejado en `st` (si es pagado o más, pagado en `at`).
create function pg_temp.pedido(cliente text, at timestamptz, st text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform pg_temp.as_user(cliente);
  select order_id into v from public.create_order(gen_random_uuid(),
    '[{"product_id":"00000000-0000-0000-0000-00000000000a","quantity":1},{"product_id":"00000000-0000-0000-0000-00000000000b","quantity":1}]',
    '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":false}');
  perform pg_temp.as_postgres();
  update public.orders set created_at = at where id = v;
  if st <> 'esperando_pago' then
    update public.orders set status = 'en_revision' where id = v;
    update public.orders set status = 'pagado' where id = v;
    update public.order_events set created_at = at where order_id = v and to_status = 'pagado';
    if st <> 'pagado' then update public.orders set status = st::public.order_status where id = v; end if;
  end if;
  return v;
end $$;
create function pg_temp.manual(product text, price int, channel text, at timestamptz) returns void language sql as $$
  insert into public.manual_sales (product_id, quantity, unit_price_cents, channel, created_by, created_at)
  values (product::uuid, 1, price, channel, '00000000-0000-0000-0000-0000000000ad', at)
$$;

-- Períodos (como postgres: dashboard_period es interna) ------------------------------------------------------
select pg_temp.as_postgres();
select is((select array[prev_from, prev_to] from public.dashboard_period('mes', '2026-10-21 10:00-04')),
  array['2026-09-01 00:00-04'::timestamptz, '2026-09-21 10:00-04'::timestamptz + interval '1 microsecond'],
  'este mes se compara con septiembre hasta el mismo día y hora');
select is((select array[cur_from, prev_to] from public.dashboard_period('mes', '2027-03-31 12:00-04')),
  array['2027-03-01 00:00-04'::timestamptz, '2027-03-01 00:00-04'::timestamptz],
  'el 31 de marzo, febrero se corta en el 1 de marzo');
select is((select array[cur_from, cur_to, prev_from, prev_to] from public.dashboard_period('mes-anterior', '2027-01-15 12:00-04')),
  array['2026-12-01 00:00-04', '2027-01-01 00:00-04', '2026-11-01 00:00-04', '2026-12-01 00:00-04']::timestamptz[],
  'mes anterior en enero: diciembre contra noviembre');
select is((select array[list_from, list_to] from public.dashboard_period('mes-anterior', '2027-01-15 12:00-04')),
  array['2026-12-01', '2026-12-31']::date[], 'la lista del mes anterior va del 1 al 31');
select is((select array[prev_from, prev_to] from public.dashboard_period('hoy', '2026-10-21 10:00-04')),
  array['2026-10-20 00:00-04'::timestamptz, '2026-10-20 10:00-04'::timestamptz + interval '1 microsecond'],
  'hoy se compara con ayer hasta la misma hora');
select is((select array[cur_from, prev_from] from public.dashboard_period('7dias', '2026-10-21 10:00-04')),
  array['2026-10-15 00:00-04', '2026-10-08 00:00-04']::timestamptz[], '7 días: del 15 al 21, contra el 8 al 14');
select is((select list_from from public.dashboard_period('12meses', '2026-10-21 10:00-04')), '2025-11-01'::date,
  '12 meses empieza en noviembre del año anterior');

-- Cubetas de las barras -------------------------------------------------------------------------------------
select is((select array_agg(b_from::text || '/' || b_to::text order by idx) from public.dashboard_buckets('mes', '2026-10-21 10:00-04')),
  array['2026-10-01/2026-10-04', '2026-10-05/2026-10-11', '2026-10-12/2026-10-18', '2026-10-19/2026-10-21'],
  'este mes: semanas de lunes a domingo recortadas al 1 y a hoy');
select is((select array_agg(b_from::text || '/' || b_to::text order by idx) from public.dashboard_buckets('mes-anterior', '2026-10-21 10:00-04')),
  array['2026-09-01/2026-09-06', '2026-09-07/2026-09-13', '2026-09-14/2026-09-20', '2026-09-21/2026-09-27', '2026-09-28/2026-09-30'],
  'septiembre (empieza en martes): 5 semanas');
select is((select array_agg(distinct kind) from public.dashboard_buckets('mes', '2026-10-21 10:00-04')), array['semana'], 'el mes va por semanas');
select is((select count(*)::int from public.dashboard_buckets('7dias', '2026-10-21 10:00-04') where kind = 'dia'), 7, '7 días: 7 barras por día');
select is((select array[min(b_from), max(b_to)] from public.dashboard_buckets('hoy', '2026-10-21 10:00-04')),
  array['2026-10-15', '2026-10-21']::date[], 'hoy: los últimos 7 días');
select is((select array_agg(b_from::text || '/' || b_to::text order by idx) from public.dashboard_buckets('12meses', '2026-10-21 10:00-04') where idx in (1, 12)),
  array['2025-11-01/2025-11-30', '2026-10-01/2026-10-31'], '12 meses: de noviembre a octubre');
select is((select count(*)::int from public.dashboard_buckets('12meses', '2026-10-21 10:00-04') where kind = 'mes'), 12, '12 barras por mes');

-- Ventas de septiembre y octubre ----------------------------------------------------------------------------
select set_config('t.sep', pg_temp.pedido('00000000-0000-0000-0000-0000000000c1', '2026-09-20 12:00-04', 'pagado')::text, true);
select pg_temp.manual('00000000-0000-0000-0000-00000000000a', 5000, 'tienda', '2026-09-25 12:00-04');
select pg_temp.pedido('00000000-0000-0000-0000-0000000000c1', '2026-10-06 12:00-04', 'entregado');
select pg_temp.pedido('00000000-0000-0000-0000-0000000000c2', '2026-10-11 23:30-04', 'pagado');
select pg_temp.pedido('00000000-0000-0000-0000-0000000000c3', '2026-10-15 12:00-04', 'reembolsado');
select pg_temp.pedido('00000000-0000-0000-0000-0000000000c3', '2026-10-03 12:00-04', 'esperando_pago');
select pg_temp.pedido('00000000-0000-0000-0000-0000000000c3', '2026-09-10 12:00-04', 'esperando_pago');
select pg_temp.manual('00000000-0000-0000-0000-00000000000a', 2000, 'tienda', '2026-10-14 12:00-04');
select pg_temp.manual('00000000-0000-0000-0000-00000000000b', 2000, 'whatsapp', '2026-10-02 12:00-04');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
create temp table d as select public.admin_dashboard_sales('mes', '2026-10-21 10:00-04') as j;

select is((select j -> 'range' from d), '{"from": "2026-10-01", "to": "2026-10-21"}'::jsonb, 'rango de la lista');
select is((select (j -> 'current' ->> 'salesCents')::int from d), 18000, 'octubre: 7000 + 7000 + 2000 + 2000');
select is((select (j -> 'current' ->> 'profitCents')::int from d), 3000, 'ganancia de octubre: 2000 + 2000 − 1000');
select is((select (j -> 'previous' ->> 'salesCents')::int from d), 7000,
  'septiembre hasta el 21 a las 10: entra el pedido del 20 y no la venta del 25');

-- Igualdades del spec §5
select is((select sum((b ->> 'salesCents')::int)::int from d, jsonb_array_elements(j -> 'bars') b), 18000, 'Σ barras = ventas');
select is((select sum((b ->> 'profitCents')::int)::int from d, jsonb_array_elements(j -> 'bars') b), 3000, 'Σ barras = ganancia');
select is((select ((j -> 'byChannel' ->> 'web')::int + (j -> 'byChannel' ->> 'tienda')::int + (j -> 'byChannel' ->> 'whatsapp')::int) from d),
  18000, 'Σ canales = ventas');
select is((select j -> 'byChannel' from d), '{"web": 14000, "tienda": 2000, "whatsapp": 2000}'::jsonb, 'ventas por canal');
select is((select j -> 'current' from d),
  (select public.admin_sales_list(null, (j -> 'range' ->> 'from')::date, (j -> 'range' ->> 'to')::date) -> 'totals' from d),
  'el resumen es igual a los totales de la lista de ventas');

-- Barras
select is((select (b ->> 'salesCents')::int from d, jsonb_array_elements(j -> 'bars') b where b ->> 'from' = '2026-10-05'), 14000,
  'el domingo 11 a las 23:30 cae en la semana del 5 al 11');
select is((select (b ->> 'profitCents')::int from d, jsonb_array_elements(j -> 'bars') b where b ->> 'from' = '2026-10-12'), -1000,
  'vender por debajo del costo da una barra negativa');
select is((select b - 'salesCents' - 'profitCents' - 'withoutCostCents' from d, jsonb_array_elements(j -> 'bars') b where b ->> 'idx' = '1'),
  '{"idx": 1, "kind": "semana", "from": "2026-10-01", "to": "2026-10-04"}'::jsonb, 'forma de una barra');

-- Clientes y pedidos
select is((select j -> 'customers' from d), '{"buyers": 2, "new": 1, "returning": 1}'::jsonb,
  'c1 vuelve, c2 es nuevo, el reembolsado de c3 no cuenta');
select is((select (j -> 'ordersByStatus' ->> 'esperando_pago')::int from d), 1, 'pedidos creados en octubre esperando pago');
select is((select (j -> 'ordersByStatus' ->> 'reembolsado')::int from d), 1, 'pedidos reembolsados de octubre');

-- Más vendidos
select is((select j -> 'top' -> 0 ->> 'name' from d), 'Juego A', 'A primero: 3 unidades como B, pero más ingresos');
select is((select (j -> 'top' -> 0 ->> 'units')::int from d), 3, 'A: 3 unidades');
select is((select (j -> 'top' -> 0 ->> 'profitCents')::int from d), 3000, 'A: ganancia 3000');
select is((select (j -> 'top' -> 1 ->> 'unitsWithoutCost')::int from d), 3, 'B: 3 unidades sin costo');
select is((select (j -> 'top' -> 0 ->> 'stock')::int from d), (select stock from public.products where name = 'Juego A'), 'trae el stock de ahora');

-- Ficha del producto: con todas las ventas de A dentro de los 12 meses, la ganancia coincide
select is((public.admin_dashboard_sales('12meses', '2026-10-21 10:00-04') -> 'top' -> 0 ->> 'profitCents')::int,
  (public.admin_product_cost_summary('00000000-0000-0000-0000-00000000000a') -> 'sold' ->> 'profitCents')::int,
  'la ganancia de A coincide con su ficha');

-- Sin ventas: todo en cero
select is((public.admin_dashboard_sales('mes-anterior', '2027-06-10 10:00-04') -> 'current' ->> 'salesCents')::int, 0, 'sin ventas: 0');
select is((select count(*)::int from jsonb_array_elements(public.admin_dashboard_sales('mes-anterior', '2027-06-10 10:00-04') -> 'bars')), 6,
  'sin ventas igual hay barras (mayo 2027 empieza en sábado: 6 semanas)');
select is(public.admin_dashboard_sales('mes-anterior', '2027-06-10 10:00-04') -> 'top', '[]'::jsonb, 'sin más vendidos');

-- Seguridad
select throws_ok($$ select public.admin_dashboard_sales('pronto', null) $$, 'P0001', 'Período desconocido', 'período desconocido');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ select public.admin_dashboard_sales('mes', null) $$, '42501', null, 'un cliente no ve el dashboard');
select throws_ok($$ select * from public.dashboard_buckets('mes', now()) $$, '42501', null, 'dashboard_buckets es interna');

select * from finish();
rollback;
