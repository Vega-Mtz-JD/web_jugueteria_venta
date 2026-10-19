-- Datos de prueba (supabase/seed.sql): la tienda y las pruebas e2e dependen de ellos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is((select count(*)::int from public.categories), 6, 'hay 6 categorías');
select is(
  (select count(*)::int from public.categories c
   where (select count(*) from public.products p where p.category_id = c.id and p.is_active) >= 2),
  6, 'cada categoría tiene al menos 2 productos activos'
);
select is((select count(*)::int from public.products where is_active), 17, 'hay 17 productos activos');
select is((select stock from public.products where slug = 'exploding-kittens'), 0, 'Exploding Kittens viene agotado');
select is(
  (select count(*)::int from public.products p
   where p.is_active and not exists (select 1 from public.product_images i where i.product_id = p.id)),
  1, 'exactamente 1 producto activo sin fotos'
);
select is((select count(*)::int from public.products where not is_sample), 0, 'todos los productos del seed son de prueba');
select is((select count(*)::int from public.store_settings), 1, 'store_settings tiene 1 fila');

select * from finish();
rollback;
