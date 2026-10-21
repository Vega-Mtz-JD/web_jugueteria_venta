-- Correcciones de la revisión final del plan 3B.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-000000000011', 'H', 't-ph', '00000000-0000-0000-0000-0000000000ca', 20000, 0);
insert into public.suppliers (id, name) values
  ('00000000-0000-0000-0000-0000000005b1', 'Proveedor Uno'),
  ('00000000-0000-0000-0000-0000000005b2', 'Proveedor Dos');

select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000ad', 'role', 'authenticated')::text, true);
create function pg_temp.compra(k text, cur text, lines jsonb) returns void language plpgsql as $$
begin
  perform set_config(k, public.admin_create_purchase(gen_random_uuid(), '00000000-0000-0000-0000-0000000005b1', current_date, cur, null, lines)::text, true);
end $$;
create function pg_temp.pagar(k text, cur text, amount int, rate numeric, kind text default 'pago') returns uuid language sql as $$
  select public.admin_record_payment(gen_random_uuid(), current_setting(k)::uuid, current_date, cur, amount, rate, null, kind)
$$;
create function pg_temp.h(qty int, price int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('product_id', '00000000-0000-0000-0000-000000000011', 'quantity', qty, 'unit_price_cents', price))
$$;

-- 1) La moneda o el proveedor no cambian si ya hay pagos (la deuda quedaría mal) ---------------------------
select pg_temp.compra('t.a', 'BOB', pg_temp.h(10, 1000));
select pg_temp.pagar('t.a', 'USD', 1000, 6.96);
select throws_like(format($$select public.admin_update_purchase('%s', '00000000-0000-0000-0000-0000000005b1', current_date, 'USD', null, '%s')$$, current_setting('t.a'), pg_temp.h(10, 1000)),
  'Primero anula los pagos para cambiar la moneda', 'no se cambia la moneda con pagos');
select throws_like(format($$select public.admin_update_purchase('%s', '00000000-0000-0000-0000-0000000005b2', current_date, 'BOB', null, '%s')$$, current_setting('t.a'), pg_temp.h(10, 1000)),
  'Primero anula los pagos para cambiar el proveedor', 'ni el proveedor');
select lives_ok(format($$select public.admin_update_purchase('%s', '00000000-0000-0000-0000-0000000005b1', current_date, 'BOB', 'nota', '%s')$$, current_setting('t.a'), pg_temp.h(8, 1000)),
  'sí se corrigen las líneas y la nota');
select pg_temp.compra('t.b', 'BOB', pg_temp.h(1, 1000));
select lives_ok(format($$select public.admin_update_purchase('%s', '00000000-0000-0000-0000-0000000005b1', current_date, 'USD', null, '%s')$$, current_setting('t.b'), pg_temp.h(1, 1000)),
  'sin pagos, la moneda se corrige');

-- 3) Un juego creado desde una compra anulada se borra de verdad; en una compra viva, se oculta -----------------
select pg_temp.compra('t.n', 'BOB', '[{"new_product":{"name":"Juego que no llegó","category_id":"00000000-0000-0000-0000-0000000000ca"},"quantity":1,"unit_price_cents":1000}]');
select set_config('t.np', (select id::text from public.products where name = 'Juego que no llegó'), true);
select public.admin_void_purchase(current_setting('t.n')::uuid);
select is(public.admin_delete_product(current_setting('t.np')::uuid), 'borrado', 'el juego de una compra anulada se borra');
select is((select count(*)::int from public.products where name = 'Juego que no llegó'), 0, 'ya no existe');
select pg_temp.compra('t.v', 'BOB', '[{"new_product":{"name":"Juego encargado vivo","category_id":"00000000-0000-0000-0000-0000000000ca"},"quantity":1,"unit_price_cents":1000}]');
select is(public.admin_delete_product((select id from public.products where name = 'Juego encargado vivo')), 'oculto', 'en una compra viva solo se oculta');

-- 6) Un dólar mal escrito no deja costos negativos ------------------------------------------------------------------
select pg_temp.compra('t.u', 'USD', pg_temp.h(10, 1000));
select public.admin_receive_purchase(current_setting('t.u')::uuid, null, 0, 6.96);
select pg_temp.pagar('t.u', 'USD', 12000, 6.96);
select throws_like($$select pg_temp.pagar('t.u', 'USD', 2000, 69.6, 'devolucion')$$, 'Revisa a cuánto estaba el dólar%', 'una devolución a 69,6 se rechaza');
select lives_ok($$select pg_temp.pagar('t.u', 'USD', 2000, 6.96, 'devolucion')$$, 'a 6,96 sí');
select ok((select bool_and(line_cost_cents >= 0) from public.purchase_items where purchase_id = current_setting('t.u')::uuid), 'costos nunca negativos');

-- 11) Saldo entre compras en dólares: sin dólar nuevo, con el dólar de lo que se pagó ---------------------------------
select pg_temp.compra('t.x', 'USD', pg_temp.h(10, 1000));
select public.admin_receive_purchase(current_setting('t.x')::uuid, null, 0, 7.00);
select pg_temp.pagar('t.x', 'USD', 11000, 6.96);
select pg_temp.compra('t.y', 'USD', pg_temp.h(1, 1000));
select lives_ok(format($$select public.admin_apply_credit(gen_random_uuid(), '%s', '%s', null)$$, current_setting('t.x'), current_setting('t.y')), 'USD → USD no pide dólar');
select is((select amount_bob_cents from public.purchase_payments where purchase_id = current_setting('t.y')::uuid and kind = 'saldo_recibido'), 6960::bigint, 'el saldo vale lo que se pagó por él: US$ 10 a 6,96');
select is((select sum(amount_bob_cents)::bigint from public.purchase_payments where purchase_id in (current_setting('t.x')::uuid, current_setting('t.y')::uuid) and voided_at is null),
  76560::bigint, 'los Bs que salieron del bolsillo no cambian');
select is((select sum(line_cost_cents)::bigint from public.purchase_items where purchase_id = current_setting('t.x')::uuid), 69600::bigint, 'el origen cuesta lo que pagó por él: 76560 − 6960');

-- Saldo entre monedas distintas: la suma de Bs se conserva
select pg_temp.compra('t.p', 'BOB', pg_temp.h(1, 1000));
select pg_temp.pagar('t.p', 'BOB', 1700, null);
select pg_temp.compra('t.q', 'USD', pg_temp.h(1, 1000));
select lives_ok(format($$select public.admin_apply_credit(gen_random_uuid(), '%s', '%s', 7.00)$$, current_setting('t.p'), current_setting('t.q')), 'Bs → US$ con dólar');
select is((select amount_purchase_cents from public.purchase_payments where purchase_id = current_setting('t.q')::uuid and kind = 'saldo_recibido'), 100, 'Bs 7 a 7,00 = US$ 1');
select is((select sum(amount_bob_cents)::bigint from public.purchase_payments where purchase_id in (current_setting('t.p')::uuid, current_setting('t.q')::uuid) and voided_at is null),
  1700::bigint, 'los Bs se conservan');

-- 12) La regla «visible con precio» está validada para todas las filas ------------------------------------------------
select set_config('role', 'postgres', true);
select ok((select convalidated from pg_constraint where conname = 'products_visible_price'), 'products_visible_price validada');

select * from finish();
rollback;
