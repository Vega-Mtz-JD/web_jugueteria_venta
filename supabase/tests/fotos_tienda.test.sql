-- Fotos de la tienda y ubicación en ajustes (etapa 2, tarea 1).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.bo'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@test.bo');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';
delete from public.store_photos;

create function pg_temp.as_user(u text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '', true);
end $$;
create function pg_temp.as_postgres() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Escritura solo de admin ------------------------------------------------------------------------------------
select pg_temp.as_anon();
select throws_ok($$ insert into public.store_photos (path, caption) values ('tienda/a.webp', 'Hola') $$, '42501', null, 'anon no sube fotos');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select throws_ok($$ insert into public.store_photos (path, caption) values ('tienda/a.webp', 'Hola') $$, '42501', null, 'un cliente no sube fotos');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000ad');
select lives_ok($$ insert into public.store_photos (path, caption, sort_order)
  select 'tienda/f' || n || '.webp', 'Foto ' || n, n from generate_series(1, 8) n $$, 'el admin sube 8 fotos');
select throws_ok($$ insert into public.store_photos (path, caption) values ('tienda/f9.webp', 'Foto 9') $$,
  'P0001', 'La tienda puede tener hasta 8 fotos', 'la novena no entra');
select lives_ok($$ update public.store_photos set caption = 'Nuestra vitrina' where path = 'tienda/f1.webp' $$, 'el admin cambia la frase');
select lives_ok($$ delete from public.store_photos where path = 'tienda/f8.webp' $$, 'el admin quita una foto');
select throws_ok($$ insert into public.store_photos (path, caption) values ('tienda/v.webp', '   ') $$, '23514', null, 'frase vacía');
select throws_ok($$ insert into public.store_photos (path, caption) values ('tienda/v.webp', repeat('a', 81)) $$, '23514', null, 'frase de 81 letras');
select lives_ok($$ insert into public.store_photos (path, caption) values ('tienda/v.webp', repeat('a', 80)) $$, 'frase de 80 letras');

-- Lectura pública --------------------------------------------------------------------------------------------
select pg_temp.as_anon();
select is((select count(*)::int from public.store_photos), 8, 'cualquiera ve las fotos');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.store_photos where caption = 'Nuestra vitrina'), 1, 'un cliente también');
select lives_ok($$ delete from public.store_photos $$, 'el delete de un cliente no falla…');
select pg_temp.as_anon();
select is((select count(*)::int from public.store_photos), 8, '…pero no borra nada');

-- Ubicación en ajustes ---------------------------------------------------------------------------------------
select pg_temp.as_postgres();
select throws_ok($$ update public.store_settings set latitude = -16.5103 where id = 1 $$, '23514', null, 'latitud sin longitud');
select throws_ok($$ update public.store_settings set latitude = 16.5, longitude = -68.1267 where id = 1 $$, '23514', null, 'fuera de Bolivia');
select throws_ok($$ update public.store_settings set latitude = -16.5103, longitude = -75 where id = 1 $$, '23514', null, 'longitud fuera de Bolivia');
select lives_ok($$ update public.store_settings set latitude = -16.5103, longitude = -68.1267 where id = 1 $$, 'coordenadas de La Paz');
select throws_ok($$ update public.store_settings set maps_url = 'https://evil.example/maps' where id = 1 $$, '23514', null, 'enlace que no es de Google Maps');
select throws_ok($$ update public.store_settings set maps_url = 'https://google.com.evil.io/maps' where id = 1 $$, '23514', null, 'dominio disfrazado');
select lives_ok($$ update public.store_settings set maps_url = 'https://maps.app.goo.gl/AbC123' where id = 1 $$, 'enlace corto de Maps');
select lives_ok($$ update public.store_settings set maps_url = 'https://www.google.com/maps/place/x' where id = 1 $$, 'enlace largo de Maps');
select throws_ok($$ update public.store_settings set zone = repeat('a', 61) where id = 1 $$, '23514', null, 'zona de 61 letras');
select lives_ok($$ update public.store_settings set zone = 'Sopocachi' where id = 1 $$, 'zona');

select * from finish();
rollback;
