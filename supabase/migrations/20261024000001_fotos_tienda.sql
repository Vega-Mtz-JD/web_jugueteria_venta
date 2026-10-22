-- Fotos de la tienda (postal de la portada) y ubicación en los ajustes (etapa 2).
-- Los archivos van en el bucket público product-images, carpeta tienda/ (mismas políticas y tipos).

create table public.store_photos (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  caption text not null check (char_length(btrim(caption)) between 1 and 80),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index store_photos_sort_idx on public.store_photos (sort_order, created_at);

alter table public.store_photos enable row level security;
create policy "fotos de la tienda: lectura pública" on public.store_photos
  for select to anon, authenticated using (true);
create policy "fotos de la tienda: admin sube" on public.store_photos
  for insert to authenticated with check ((select public.is_admin()));
create policy "fotos de la tienda: admin edita" on public.store_photos
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "fotos de la tienda: admin borra" on public.store_photos
  for delete to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.store_photos from anon;

-- Hasta 8 fotos: más no suma confianza y pesa más en la portada.
create or replace function public.store_photos_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Dos subidas a la vez no pueden pasar las dos de 8.
  perform pg_advisory_xact_lock(hashtext('store_photos_limit'));
  if (select count(*) from public.store_photos) >= 8 then
    raise exception 'La tienda puede tener hasta 8 fotos' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke execute on function public.store_photos_limit() from public, anon, authenticated;

create trigger store_photos_limit
  before insert on public.store_photos
  for each row execute function public.store_photos_limit();

-- Ubicación de la tienda ---------------------------------------------------------------------------------------
alter table public.store_settings
  add column zone text check (char_length(zone) <= 60),
  add column maps_url text check (maps_url ~ '^https://((www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?/maps|maps\.google\.[a-z]{2,3}(\.[a-z]{2})?/|maps\.app\.goo\.gl/|goo\.gl/maps/)'),
  add column latitude numeric(9, 6) check (latitude between -23 and -9),
  add column longitude numeric(9, 6) check (longitude between -70 and -57),
  add constraint store_settings_coordinates check ((latitude is null) = (longitude is null));

-- Borrar archivos: storage hace DELETE … RETURNING, que con RLS también exige poder LEER la fila.
-- Sin esto, quitar una foto (de la tienda, de un producto o un QR) dejaba el archivo suelto sin dar error.
create policy "fotos de productos: admin lee" on storage.objects
  for select to authenticated using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "recursos de la tienda: admin lee" on storage.objects
  for select to authenticated using (bucket_id = 'store-assets' and (select public.is_admin()));
