-- Catálogo: perfiles, categorías, productos, imágenes y ajustes de la tienda.
-- La seguridad la aplica Postgres con RLS: el código de la web no puede saltársela.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- unaccent no es "immutable", y una columna generada lo exige: lo envolvemos
-- fijando el diccionario.
create or replace function public.immutable_unaccent(text)
returns text
language sql
immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, $1) $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Perfiles ----------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Un usuario solo puede cambiar su nombre y teléfono, nunca su rol.
-- (Asignar administradores se hará con una función propia en el plan 3.)
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "perfil: ver el propio o admin ve todos" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "perfil: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Categorías --------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.categories enable row level security;

create policy "categorías: lectura pública" on public.categories
  for select to anon, authenticated using (true);
create policy "categorías: admin gestiona" on public.categories
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Productos ---------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category_id uuid not null references public.categories (id) on delete restrict,
  price_cents int not null check (price_cents >= 0),
  compare_at_cents int check (compare_at_cents is null or compare_at_cents > price_cents),
  min_age smallint check (min_age between 0 and 99),
  min_players smallint check (min_players >= 1),
  max_players smallint check (max_players is null or max_players >= min_players),
  stock int not null default 0 check (stock >= 0),
  is_new boolean not null default false,
  is_active boolean not null default true,
  is_sample boolean not null default false,
  search_text text generated always as (
    public.immutable_unaccent(lower(trim(name || ' ' || coalesce(description, ''))))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.products enable row level security;

create index products_category_id_idx on public.products (category_id);
create index products_search_text_trgm_idx on public.products using gin (search_text extensions.gin_trgm_ops);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

create policy "productos: lectura pública de activos" on public.products
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "productos: admin crea" on public.products
  for insert to authenticated with check ((select public.is_admin()));
create policy "productos: admin edita" on public.products
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "productos: admin borra" on public.products
  for delete to authenticated using ((select public.is_admin()));

-- Imágenes de productos ---------------------------------------------------
create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  path text not null,
  alt text,
  sort_order int not null default 0
);
alter table public.product_images enable row level security;

create index product_images_product_id_idx on public.product_images (product_id);

create policy "imágenes: lectura pública de productos activos" on public.product_images
  for select to anon, authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and (p.is_active or (select public.is_admin()))
  ));
create policy "imágenes: admin gestiona" on public.product_images
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Ajustes de la tienda (una sola fila) -------------------------------------
create table public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null,
  tagline text,
  whatsapp_phone text,
  address text,
  pickup_hours text,
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;

create trigger store_settings_set_updated_at
  before update on public.store_settings
  for each row execute function public.set_updated_at();

create policy "ajustes: lectura pública" on public.store_settings
  for select to anon, authenticated using (true);
create policy "ajustes: admin gestiona" on public.store_settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Borrar productos de prueba ----------------------------------------------
create or replace function public.delete_sample_products()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted integer;
begin
  if not public.is_admin() then
    raise exception 'Solo un administrador puede borrar los productos de prueba'
      using errcode = '42501';
  end if;
  delete from public.products where is_sample;
  get diagnostics deleted = row_count;
  return deleted;
end;
$$;

revoke execute on function public.delete_sample_products() from public, anon;
grant execute on function public.delete_sample_products() to authenticated;

-- Storage: fotos de productos (lectura pública, escritura solo admin) -------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "fotos de productos: admin sube" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and (select public.is_admin()));
create policy "fotos de productos: admin edita" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
create policy "fotos de productos: admin borra" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_admin()));
