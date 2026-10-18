-- Esquema del catálogo y reglas de seguridad (RLS).
-- Cada prueba crea sus propios datos (slugs "t-...") y todo se deshace al final.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

-- Estructura -------------------------------------------------------------
select has_table('public', 'profiles', 'existe profiles');
select has_table('public', 'categories', 'existe categories');
select has_table('public', 'products', 'existe products');
select has_table('public', 'product_images', 'existe product_images');
select has_table('public', 'store_settings', 'existe store_settings');
select ok(
  (select bool_and(relrowsecurity) from pg_class
   where oid in ('public.profiles'::regclass, 'public.categories'::regclass, 'public.products'::regclass,
                 'public.product_images'::regclass, 'public.store_settings'::regclass)),
  'RLS activo en las cinco tablas'
);

-- Datos de la prueba (como postgres) -------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000b1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
insert into public.categories (id, name, slug) values ('00000000-0000-0000-0000-0000000000c1', 'Test', 't-cat');
insert into public.products (name, slug, category_id, price_cents, is_active, is_sample) values
  ('Activo',   't-activo',   '00000000-0000-0000-0000-0000000000c1', 1000, true,  false),
  ('Inactivo', 't-inactivo', '00000000-0000-0000-0000-0000000000c1', 1000, false, false),
  ('Muestra',  't-muestra',  '00000000-0000-0000-0000-0000000000c1', 1000, true,  true);
insert into public.store_settings (store_name) values ('Tienda test') on conflict (id) do nothing;
select set_config('test.n_samples', (select count(*) from public.products where is_sample)::text, true);

select is(
  (select role from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'customer',
  'al registrarse un usuario se crea su perfil como customer'
);

-- Visitante sin cuenta (anon) --------------------------------------------
set local role anon;
select is((select count(*)::int from public.products where slug = 't-activo'), 1, 'anon ve productos activos');
select is((select count(*)::int from public.products where slug = 't-inactivo'), 0, 'anon no ve productos inactivos');
select throws_ok(
  $$insert into public.products (name, slug, category_id, price_cents)
    values ('x', 't-x', '00000000-0000-0000-0000-0000000000c1', 1)$$,
  '42501', null, 'anon no puede crear productos'
);
select is_empty($$update public.store_settings set store_name = 'hack' returning 1$$, 'anon no puede editar los ajustes');
reset role;

-- Cliente con cuenta, no admin -------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';
select throws_ok(
  $$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000b1'$$,
  '42501', null, 'un cliente no puede hacerse admin'
);
select is((select count(*)::int from public.profiles), 1, 'un cliente solo ve su propio perfil');
select throws_ok($$select public.delete_sample_products()$$, '42501', null, 'un cliente no puede borrar los productos de prueba');
reset role;

-- Administrador -----------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated"}';
select lives_ok(
  $$insert into public.products (name, slug, category_id, price_cents)
    values ('Admin', 't-admin', '00000000-0000-0000-0000-0000000000c1', 500)$$,
  'admin puede crear productos'
);
select is((select count(*)::int from public.products where slug = 't-inactivo'), 1, 'admin ve productos inactivos');
select is(public.delete_sample_products(), current_setting('test.n_samples')::int, 'delete_sample_products devuelve cuántos borró');
select is(
  (select count(*)::int from public.products where slug in ('t-activo', 't-inactivo', 't-admin')), 3,
  'delete_sample_products no toca los productos reales'
);
reset role;

-- Restricciones y búsqueda (como postgres) -------------------------------
select throws_ok(
  $$insert into public.products (name, slug, category_id, price_cents, min_players, max_players)
    values ('x', 't-x1', '00000000-0000-0000-0000-0000000000c1', 1, 4, 2)$$,
  '23514', null, 'max_players no puede ser menor que min_players'
);
select throws_ok(
  $$insert into public.products (name, slug, category_id, price_cents, compare_at_cents)
    values ('x', 't-x2', '00000000-0000-0000-0000-0000000000c1', 1000, 1000)$$,
  '23514', null, 'el precio anterior debe ser mayor que el precio'
);
insert into public.products (name, slug, category_id, price_cents)
  values ('Catán Junior', 't-catan', '00000000-0000-0000-0000-0000000000c1', 1000);
select is((select search_text from public.products where slug = 't-catan'), 'catan junior', 'search_text queda en minúsculas y sin tildes');

select * from finish();
rollback;
