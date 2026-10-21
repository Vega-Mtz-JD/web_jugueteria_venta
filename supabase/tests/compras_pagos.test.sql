-- Pagos en Bs o dólares, dólar efectivo y saldo a favor (plan 3B, tarea 2).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock) values
  ('00000000-0000-0000-0000-000000000011', 'H', 't-ph', '00000000-0000-0000-0000-0000000000ca', 20000, 0),
  ('00000000-0000-0000-0000-000000000012', 'J', 't-pj', '00000000-0000-0000-0000-0000000000ca', 20000, 0);
insert into public.suppliers (id, name) values
  ('00000000-0000-0000-0000-0000000005b1', 'Proveedor Uno'),
  ('00000000-0000-0000-0000-0000000005b2', 'Proveedor Dos');

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.compra(k text, supplier text, cur text, product text, qty int, price int) returns void language plpgsql as $$
begin
  perform set_config(k, public.admin_create_purchase(gen_random_uuid(), supplier::uuid, current_date, cur, null,
    jsonb_build_array(jsonb_build_object('product_id', product, 'quantity', qty, 'unit_price_cents', price)))::text, true);
end $$;
create function pg_temp.recibir(k text, rate numeric) returns void language sql as $$
  select public.admin_receive_purchase(current_setting(k)::uuid, null, 0, rate)
$$;
create function pg_temp.pagar(k text, cur text, amount int, rate numeric, kind text default 'pago', req uuid default gen_random_uuid()) returns uuid language sql as $$
  select public.admin_record_payment(req, current_setting(k)::uuid, current_date, cur, amount, rate, null, kind)
$$;
create function pg_temp.deuda(k text) returns bigint language sql as $$ select debt_cents from public.purchase_balances where id = current_setting(k)::uuid $$;
create function pg_temp.costo(k text) returns bigint language sql as $$ select sum(line_cost_cents)::bigint from public.purchase_items where purchase_id = current_setting(k)::uuid $$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');

-- Compra en dólares: adelanto en US$, llegada, saldo en Bs a otro dólar -----------------------------------------
select pg_temp.compra('t.u', '00000000-0000-0000-0000-0000000005b1', 'USD', '00000000-0000-0000-0000-000000000011', 10, 1000);
select throws_like($$select pg_temp.pagar('t.u', 'USD', 4000, null)$$, 'Anota a cuánto estaba el dólar', 'un pago en dólares pide el dólar');
select pg_temp.pagar('t.u', 'USD', 4000, 6.96);
select is((select amount_bob_cents from public.purchase_payments where purchase_id = current_setting('t.u')::uuid), 27840::bigint, 'US$ 40 a 6,96 = Bs 278,40');
select pg_temp.recibir('t.u', 7.00);
select is(pg_temp.deuda('t.u'), 6000::bigint, 'se deben US$ 60');
select is(pg_temp.costo('t.u'), 69840::bigint, 'costo: Bs 278,40 pagados + US$ 60 a 7,00');
select set_config('t.req', gen_random_uuid()::text, true);
select pg_temp.pagar('t.u', 'BOB', 42600, 7.10, 'pago', current_setting('t.req')::uuid);
select pg_temp.pagar('t.u', 'BOB', 42600, 7.10, 'pago', current_setting('t.req')::uuid);
select is((select count(*)::int from public.purchase_payments where purchase_id = current_setting('t.u')::uuid), 2, 'el mismo envío del pago se guarda una vez');
select is((select amount_purchase_cents from public.purchase_payments where request_id = current_setting('t.req')::uuid), 6000, 'Bs 426 a 7,10 pagan US$ 60');
select is(pg_temp.deuda('t.u'), 0::bigint, 'pagada del todo');
select is(pg_temp.costo('t.u'), 70440::bigint, 'el costo es exactamente lo que salió del bolsillo: 278,40 + 426');

-- Saldo a favor -----------------------------------------------------------------------------------------------------
select pg_temp.compra('t.a', '00000000-0000-0000-0000-0000000005b1', 'BOB', '00000000-0000-0000-0000-000000000012', 1, 1000);
select pg_temp.recibir('t.a', null);
select pg_temp.pagar('t.a', 'BOB', 1200, null);
select is(pg_temp.deuda('t.a'), -200::bigint, 'pagó de más: saldo a favor de Bs 2');
select pg_temp.compra('t.b', '00000000-0000-0000-0000-0000000005b1', 'BOB', '00000000-0000-0000-0000-000000000012', 1, 500);
select pg_temp.compra('t.otro', '00000000-0000-0000-0000-0000000005b2', 'BOB', '00000000-0000-0000-0000-000000000012', 1, 500);
select throws_like(format($$select public.admin_apply_credit(gen_random_uuid(), '%s', '%s', null)$$, current_setting('t.a'), current_setting('t.otro')),
  'Solo se puede usar el saldo en una compra del mismo proveedor', 'no se pasa a otro proveedor');
select lives_ok(format($$select public.admin_apply_credit(gen_random_uuid(), '%s', '%s', null)$$, current_setting('t.a'), current_setting('t.b')), 'usar el saldo en otra compra');
select is(pg_temp.deuda('t.a') || '/' || pg_temp.deuda('t.b'), '0/300', 'el origen queda en 0 y el destino debe 300');
select throws_like(format($$select public.admin_apply_credit(gen_random_uuid(), '%s', '%s', null)$$, current_setting('t.a'), current_setting('t.b')),
  'Esta compra no tiene saldo a favor', 'sin saldo no se pasa nada');
select lives_ok(format($$select public.admin_void_payment('%s')$$, (select id from public.purchase_payments where purchase_id = current_setting('t.b')::uuid and kind = 'saldo_recibido')),
  'anular el traspaso');
select is(pg_temp.deuda('t.a') || '/' || pg_temp.deuda('t.b'), '-200/500', 'se anulan los dos lados');
select pg_temp.pagar('t.a', 'BOB', 200, null, 'devolucion');
select is(pg_temp.deuda('t.a'), 0::bigint, 'el proveedor devolvió el saldo');
select is((select amount_cents from public.purchase_payments where purchase_id = current_setting('t.a')::uuid and kind = 'devolucion'), -200, 'la devolución se guarda en negativo');

-- No se anula una compra con pagos ----------------------------------------------------------------------------------
select throws_like(format($$select public.admin_void_purchase('%s')$$, current_setting('t.a')), 'Primero anula los pagos de esta compra', 'primero los pagos');

-- Lo que se debe a cada proveedor, por moneda -----------------------------------------------------------------------
select is((select sum(debt_cents)::int from public.purchase_balances where supplier_id = '00000000-0000-0000-0000-0000000005b1' and currency = 'BOB' and debt_cents > 0),
  500, 'al proveedor uno se le deben Bs 5');

-- Seguridad -------------------------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok(format($$select public.admin_record_payment(gen_random_uuid(), '%s', current_date, 'BOB', 100, null, null, 'pago')$$, current_setting('t.b')),
  '42501', null, 'un cliente no registra pagos');
select throws_ok(format($$select public.admin_void_payment('%s')$$, gen_random_uuid()), '42501', null, 'un cliente no anula pagos');
select throws_ok(format($$select public.admin_apply_credit(gen_random_uuid(), '%s', '%s', null)$$, current_setting('t.a'), current_setting('t.b')), '42501', null, 'un cliente no mueve saldos');

select * from finish();
rollback;
