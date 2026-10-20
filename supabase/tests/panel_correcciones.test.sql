-- Correcciones de la revisión final del plan 3A.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

delete from public.orders;
delete from public.manual_sales;
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000ca', 'Test', 't-cat');
insert into public.products (id, name, slug, category_id, price_cents, stock, is_sample) values
  ('00000000-0000-0000-0000-0000000000f1', 'Muestra vendida en tienda', 't-m1', '00000000-0000-0000-0000-0000000000ca', 1000, 10, true),
  ('00000000-0000-0000-0000-0000000000f2', 'Juego real', 't-r1', '00000000-0000-0000-0000-0000000000ca', 1000, 10, false);

create function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000ad', 'role', 'authenticated')::text, true);
end $$;
select pg_temp.as_admin();

-- 1) Una muestra con venta manual se oculta en vez de romper el borrado --------------------------
select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f1', 1, 'tienda', 1000, null, gen_random_uuid());
select lives_ok($$select public.delete_sample_products()$$, 'borrar muestras funciona aunque una tenga venta manual');
select is((select is_active from public.products where id = '00000000-0000-0000-0000-0000000000f1'), false, 'la muestra vendida en tienda queda oculta');

-- 2) La misma venta enviada dos veces (respuesta perdida) se registra una sola vez -----------------
select set_config('t.req', gen_random_uuid()::text, true);
select set_config('t.s1', public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f2', 2, 'tienda', 1000, null, current_setting('t.req')::uuid)::text, true);
select is(public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f2', 2, 'tienda', 1000, null, current_setting('t.req')::uuid)::text,
  current_setting('t.s1'), 'el reintento devuelve la misma venta');
select is((select stock from public.products where id = '00000000-0000-0000-0000-0000000000f2'), 8, 'el stock baja una sola vez');
select is((select count(*)::int from public.manual_sales where product_id = '00000000-0000-0000-0000-0000000000f2'), 1, 'una sola venta registrada');

-- 3) Un monto enorme (error de tipeo) no tumba el resumen -------------------------------------------
select set_config('role', 'postgres', true);
insert into public.manual_sales (product_id, quantity, unit_price_cents, channel, created_by)
values ('00000000-0000-0000-0000-0000000000f2', 100, 50000000, 'tienda', '00000000-0000-0000-0000-0000000000ad');
select pg_temp.as_admin();
select lives_ok($$select public.admin_dashboard_summary()$$, 'el resumen soporta montos grandes');
select throws_like($$select public.admin_record_manual_sale('00000000-0000-0000-0000-0000000000f2', 1, 'tienda', 10000001, null, gen_random_uuid())$$,
  'Revisa el precio%', 'el precio de una venta manual tiene tope de Bs 100.000');

select * from finish();
rollback;
