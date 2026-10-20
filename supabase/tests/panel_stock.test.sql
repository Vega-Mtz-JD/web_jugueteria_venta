-- Historial de stock, ventas manuales y conteo de estante (plan 3A, tarea 1).
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
  ('00000000-0000-0000-0000-0000000000f5', 'Juego cinco', 't-s5', '00000000-0000-0000-0000-0000000000ca', 1000, 5),
  ('00000000-0000-0000-0000-0000000000f1', 'Juego uno', 't-s1', '00000000-0000-0000-0000-0000000000ca', 1000, 1),
  ('00000000-0000-0000-0000-0000000000f3', 'Juego tres', 't-s3', '00000000-0000-0000-0000-0000000000ca', 1000, 5);

create function pg_temp.stock(p text) returns int language sql as $$ select stock from public.products where slug = p $$;
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
create function pg_temp.pedido(p uuid, req uuid, q int) returns uuid language sql as $$
  select order_id from public.create_order(req, jsonb_build_array(jsonb_build_object('product_id', p, 'quantity', q)),
    '{"method":"recojo","recipient_name":"Ana","phone":"71234567"}', '{"requested":false}')
$$;

-- Alta y ventas web -------------------------------------------------------------------------
select is((select count(*)::int from public.stock_movements where product_id = '00000000-0000-0000-0000-0000000000f5' and reason = 'alta' and delta = 5), 1, 'crear un producto registra el alta');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select set_config('t.o1', pg_temp.pedido('00000000-0000-0000-0000-0000000000f5', '00000000-0000-0000-0000-000000000101', 2)::text, true);
select pg_temp.as_postgres();
select is((select count(*)::int from public.stock_movements where reason = 'venta_web' and delta = -2 and ref_id = current_setting('t.o1')::uuid), 1, 'un pedido web registra la venta con su referencia');
update public.orders set status = 'rechazado' where id = current_setting('t.o1')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.cancel_order_by_customer(current_setting('t.o1')::uuid);
select pg_temp.as_postgres();
select is((select count(*)::int from public.stock_movements where reason = 'devolucion_web' and delta = 2 and ref_id = current_setting('t.o1')::uuid), 1, 'cancelar devuelve y lo registra');

-- Ventas manuales ------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select set_config('t.v1', (select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f5', 2, 'tienda', 1000, null))::text, true);
select is(pg_temp.stock('t-s5'), 3, 'la venta en tienda descuenta stock');
select is((select count(*)::int from public.stock_movements where reason = 'venta_manual' and delta = -2), 1, 'la venta manual queda en el historial');
select lives_ok(format($$select public.admin_void_manual_sale('%s')$$, current_setting('t.v1')), 'anular una venta manual');
select is(pg_temp.stock('t-s5'), 5, 'anular devuelve el stock');
select throws_like(format($$select public.admin_void_manual_sale('%s')$$, current_setting('t.v1')), '%ya estaba anulada%', 'no se anula dos veces');
select throws_like($$select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f5', 9, 'whatsapp', 1000, null)$$,
  'El stock registrado no alcanza (quedan 5 disponibles)%', 'no se vende más de lo disponible');

-- Unidad apartada por un pedido web --------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select pg_temp.pedido('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000102', 1);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select throws_like($$select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f1', 1, 'tienda', 1000, null)$$,
  '%apartadas por el pedido #%', 'una unidad apartada no se vende en la tienda y se dice qué pedido la tiene');

-- Contar estante -----------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select set_config('t.o3', pg_temp.pedido('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000103', 1)::text, true);
select set_config('t.o4', pg_temp.pedido('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-000000000104', 1)::text, true);
select pg_temp.as_postgres();
update public.orders set status = 'en_revision' where id = current_setting('t.o3')::uuid;
update public.orders set status = 'pagado' where id = current_setting('t.o4')::uuid;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select is((select quantity from public.admin_reserved_units() where product_id = '00000000-0000-0000-0000-0000000000f3'), 2, 'en revisión y pagado sin retirar cuentan como apartadas');
select is(public.admin_count_shelf('00000000-0000-0000-0000-0000000000f3', 6), 4, 'contar 6 con 2 apartadas deja 4 disponibles');
select is((select count(*)::int from public.stock_movements where product_id = '00000000-0000-0000-0000-0000000000f3' and reason = 'ajuste' and note = 'Conteo de estante: 6'), 1, 'el conteo queda en el historial');
select throws_like($$select public.admin_count_shelf('00000000-0000-0000-0000-0000000000f3', 1)$$, 'Contaste menos de lo apartado%', 'no se puede contar menos que lo apartado');
select throws_like($$select public.admin_adjust_stock('00000000-0000-0000-0000-0000000000f3', -99)$$, '%negativo%', 'el ajuste no deja stock negativo');
select is(public.admin_adjust_stock('00000000-0000-0000-0000-0000000000f3', 2), 6, 'el ajuste suma');

-- Seguridad ----------------------------------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f5', 1, 'tienda', 1000, null)$$, '42501', null, 'un cliente no registra ventas manuales');
select throws_ok($$select public.admin_count_shelf('00000000-0000-0000-0000-0000000000f5', 9)$$, '42501', null, 'un cliente no cuenta estante');
select throws_ok($$select public.admin_adjust_stock('00000000-0000-0000-0000-0000000000f5', 9)$$, '42501', null, 'un cliente no ajusta stock');
select throws_ok($$select * from public.admin_reserved_units()$$, '42501', null, 'un cliente no ve las apartadas');
select is((select count(*)::int from public.stock_movements), 0, 'un cliente no ve el historial de stock');
select is((select count(*)::int from public.manual_sales), 0, 'un cliente no ve las ventas manuales');

-- El historial cuadra con el stock -------------------------------------------------------------------
select pg_temp.as_postgres();
select is(
  (select count(*)::int from public.products p
   where p.slug like 't-s%' and p.stock <> (select coalesce(sum(delta), 0) from public.stock_movements m where m.product_id = p.id)),
  0, 'la suma del historial es igual al stock de cada producto'
);

select * from finish();
rollback;
