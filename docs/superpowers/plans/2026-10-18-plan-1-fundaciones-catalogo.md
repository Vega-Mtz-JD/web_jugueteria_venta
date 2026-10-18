# Plan 1 — Fundaciones y catálogo público

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tienda navegable sin cuenta (inicio con el estilo aprobado, catálogo con filtros y buscador, ficha de producto) sobre Supabase con datos de prueba, con CI en GitHub y publicada en Netlify.

**Architecture:** Next.js (App Router, Server Components) lee el catálogo de Supabase con `@supabase/ssr`; la seguridad la dan políticas RLS en Postgres, no el código. Los filtros viven en la URL (`searchParams`), así los enlaces se pueden compartir por WhatsApp. El código se organiza por funcionalidad (`src/features/catalog`) y las utilidades puras en `src/lib`, todas con pruebas unitarias.

**Tech Stack:** Node 22 · Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · shadcn/ui · Motion · Supabase (Postgres, Storage, CLI local con Docker) · Vitest + Testing Library · Playwright · pgTAP (`supabase test db`) · GitHub Actions · Netlify

**Spec:** `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md` (hoja de ruta: `docs/superpowers/plans/README.md`)

**Nota para Diego (aprendiendo):** equivalencias rápidas — *Server Component* ≈ vista Blade que corre en el servidor; *Client Component* (`"use client"`) ≈ componente Vue en el navegador; *migración de Supabase* ≈ migración de Laravel pero en SQL; *RLS* ≈ Policies de Laravel, pero aplicadas por la base de datos misma.

## Global Constraints

- Node **22** (`.nvmrc` = `22`); `@supabase/supabase-js` y Vitest 5 exigen Node ≥ 22.
- Todo el texto visible en **español**; `<html lang="es">`.
- Moneda: precios guardados como **enteros en centavos** (`price_cents`); se muestran como `Bs 120`, `Bs 1.250`, `Bs 120,50` (separador de miles `.`, decimales `,` solo si no son cero).
- Paleta (spec 5.8): crema `#f6efe3` / `#efe4d2`, tinta `#2b2118`, madera `#7a5230`, verde `#1f4d3a` / `#2c6a50`, mostaza `#c9a227`, rojo `#c0392b`. Cubo: rojo `#c0392b`, crema `#f3e6c8`, verde `#3f8a63`, mostaza `#d9b23a`, naranja `#d9822b`, azul `#2f5d8a`.
- Tipografía: **Fraunces** (títulos) + **Inter** (texto), vía `next/font/google`.
- `prefers-reduced-motion: reduce` ⇒ ninguna animación ni transición decorativa.
- Sin funciones exclusivas de Vercel; debe correr en Netlify (adaptador oficial de Next.js de Netlify).
- Secretos nunca en el repo: solo `.env.example` con nombres de variables.
- Nombre de tienda de relleno: **"Ludiq"**, en un solo lugar (`store_settings`), para cambiarlo sin tocar código.
- Sin botón de favoritos (spec 5.8).
- Productos sin stock: visibles con "Agotado", nunca ocultos.
- Rutas y parámetros en español: `/catalogo`, `/producto/[slug]`; `categoria`, `q`, `precio_min`, `precio_max`, `edad`, `jugadores`, `ofertas`, `orden`.
- Ramas: trabajo en `feat/plan-1-catalogo`; entra a `main` por Pull Request (spec 5.11).
- Skills a usar durante la ejecución: `frontend-design` + `ui-ux-pro-max` + `design-system` (Tareas 6–9), `ui-styling` (componentes shadcn), `react-best-practices`, `webapp-testing` (e2e), `verification-before-completion` (antes de cada commit que declare algo terminado).

## Review Focus

1. **Búsqueda con tildes, mayúsculas o símbolos** (`catan`, `CATÁN`, `50%`, `o'neil`) ⇒ encuentra "Catán" y nunca da error 500 → prueba en Tarea 5.
2. **Parámetros de URL inválidos** (`?precio_min=abc&jugadores=-3&categoria=no-existe`) ⇒ se ignoran y se muestra el catálogo, no un error → pruebas en Tareas 5 y 9.
3. **Producto sin fotos** ⇒ se muestra una imagen de relleno con la paleta, no un hueco ni un crash → pruebas en Tareas 5 y 9.
4. **Nombres y descripciones largas en celular de 360 px** ⇒ se recortan con elipsis, la página nunca hace scroll horizontal → prueba e2e en Tarea 9.
5. **Enlace viejo a un producto oculto o inexistente** (compartido por WhatsApp) ⇒ página 404 amable con botón "Ver catálogo" → prueba e2e en Tarea 10.

---

## Estructura de archivos

```
.nvmrc · .env.example · netlify.toml · vitest.config.ts · playwright.config.ts
.github/workflows/ci.yml
supabase/
  config.toml
  migrations/20261018000001_catalogo.sql      # tablas, RLS, storage, funciones
  seed.sql                                     # categorías, ajustes, productos de prueba
  tests/catalogo_rls.test.sql                  # pgTAP
public/samples/*.svg                           # ilustraciones de relleno de productos
src/
  app/
    layout.tsx · globals.css · not-found.tsx · sitemap.ts · robots.ts
    (tienda)/layout.tsx                        # header + footer
    (tienda)/page.tsx                          # inicio
    (tienda)/catalogo/page.tsx
    (tienda)/producto/[slug]/page.tsx
    (tienda)/producto/[slug]/not-found.tsx
  components/ui/*                              # shadcn
  components/brand/Logo.tsx · Cube3D.tsx · IllimaniLandscape.tsx · FloatingPieces.tsx
  components/layout/SiteHeader.tsx · SiteFooter.tsx
  features/catalog/
    types.ts · filters.ts · queries.ts
    ProductCard.tsx · ProductGrid.tsx · CategoryGrid.tsx · CatalogFilters.tsx · ProductGallery.tsx
  lib/money.ts · labels.ts · search.ts · whatsapp.ts · images.ts
  lib/supabase/server.ts · client.ts · database.types.ts (generado)
e2e/*.spec.ts
```

Pruebas unitarias junto al archivo (`money.test.ts` al lado de `money.ts`). Pruebas de integración contra Supabase local: `*.int.test.ts`.

---

### Task 1: Proyecto base, pruebas y CI

**Files:**
- Create: proyecto Next.js en la raíz, `.nvmrc`, `vitest.config.ts`, `vitest.setup.ts`, `playwright.config.ts`, `e2e/smoke.spec.ts`, `.github/workflows/ci.yml`, `.env.example`
- Modify: `.gitignore` (conservar lo existente, añadir lo que genere create-next-app)

**Interfaces:**
- Produces: scripts npm `dev`, `build`, `lint`, `typecheck` (`tsc --noEmit`), `test` (Vitest, excluye `*.int.test.ts`), `test:int` (solo `*.int.test.ts`), `test:e2e` (Playwright), `db:test` (`supabase test db`). Alias `@/*` → `src/*`.

- [ ] **Step 1: [Diego] Instalar Node 22** con nvm (`curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash`, luego `nvm install 22 && nvm use 22`). Verificar: `node -v` → `v22.x`.
- [ ] **Step 2: Crear rama** `git checkout -b feat/plan-1-catalogo`.
- [ ] **Step 3: Generar el proyecto** en la raíz con `npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (no debe borrar `docs/`, `.claude/`, `.gitignore`; si se niega por carpeta no vacía, generar en una temporal y mover). Escribir `.nvmrc` con `22`.
- [ ] **Step 4: Instalar herramientas de prueba:** `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`; `npx playwright install chromium`. Configurar Vitest (entorno jsdom, alias `@`, `setupFiles` con jest-dom) y Playwright (`webServer: npm run build && npm run start`, `baseURL http://localhost:3000`, proyectos `desktop` 1280×800 y `mobile` 360×780).
- [ ] **Step 5: Escribir la prueba e2e de humo** `e2e/smoke.spec.ts`:

```ts
test('la página de inicio responde en español', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
});
```

- [ ] **Step 6: Correr y ver que falla** `npm run test:e2e -- smoke` → FAIL (lang es `en`).
- [ ] **Step 7: Poner `lang="es"`** en `src/app/layout.tsx` y quitar el contenido de demostración de create-next-app en `page.tsx` (deja un `<main>` vacío con "Ludiq").
- [ ] **Step 8: Correr y ver que pasa** `npm run test:e2e -- smoke` → PASS.
- [ ] **Step 9: CI** `.github/workflows/ci.yml` en `push` y `pull_request`: job `check` (Node 22 desde `.nvmrc`, `npm ci`, `lint`, `typecheck`, `test`, `build`) y job `db` (`supabase/setup-cli`, `supabase start`, `supabase test db`, `npm run test:int` y `npm run test:e2e` con las variables de `supabase status -o env`; las e2e necesitan la base con el seed). El job `db` puede fallar hasta la Tarea 3: márcalo `continue-on-error: true` aquí y quítalo en la Tarea 3. Mientras tanto la prueba de humo se corre localmente.
- [ ] **Step 10: `.env.example`** con `NEXT_PUBLIC_SUPABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=`, `NEXT_PUBLIC_SITE_URL=`.
- [ ] **Step 11: Commit** `chore: proyecto Next.js base con Vitest, Playwright y CI`; push de la rama y verificar que el job `check` de CI queda verde.

---

### Task 2: Utilidades de dominio (dinero, etiquetas, búsqueda, WhatsApp, imágenes)

**Files:**
- Create: `src/lib/money.ts`, `labels.ts`, `search.ts`, `whatsapp.ts`, `images.ts` y sus `*.test.ts`

**Interfaces:**
- Produces:
  - `formatBs(cents: number): string`
  - `bsToCents(bs: number): number`
  - `ageLabel(minAge: number | null): string | null`
  - `playersLabel(min: number | null, max: number | null): string | null`
  - `normalizeSearch(q: string): string` — minúsculas, sin tildes (`ñ` se conserva como `n`), espacios colapsados, recortado
  - `escapeLike(s: string): string` — escapa `\`, `%`, `_` para patrones `ILIKE`
  - `buildWhatsAppLink(phone: string, message: string): string`
  - `productImageUrl(path: string | null, supabaseUrl: string): string` — `null` ⇒ `/samples/placeholder.svg`; empieza con `/` ⇒ tal cual; si no ⇒ `${supabaseUrl}/storage/v1/object/public/product-images/${path}`

- [ ] **Step 1: Escribir las pruebas que fallan:**

```ts
expect(formatBs(12000)).toBe('Bs 120');
expect(formatBs(125000)).toBe('Bs 1.250');
expect(formatBs(12050)).toBe('Bs 120,50');
expect(formatBs(0)).toBe('Bs 0');
expect(bsToCents(120.5)).toBe(12050);
expect(ageLabel(8)).toBe('8+ años');           expect(ageLabel(null)).toBeNull();
expect(playersLabel(2, 4)).toBe('2–4 jugadores');
expect(playersLabel(1, 1)).toBe('1 jugador');
expect(playersLabel(2, null)).toBe('2+ jugadores');
expect(playersLabel(null, null)).toBeNull();
expect(normalizeSearch('  CATÁN   Niños ')).toBe('catan ninos');
expect(escapeLike('50%_a\\b')).toBe('50\\%\\_a\\\\b');
expect(buildWhatsAppLink('+591 712-34567', 'Hola, consulto por Catán'))
  .toBe('https://wa.me/59171234567?text=Hola%2C%20consulto%20por%20Cat%C3%A1n');
expect(productImageUrl(null, 'https://x.supabase.co')).toBe('/samples/placeholder.svg');
expect(productImageUrl('/samples/catan.svg', 'https://x.supabase.co')).toBe('/samples/catan.svg');
expect(productImageUrl('p/1.webp', 'https://x.supabase.co'))
  .toBe('https://x.supabase.co/storage/v1/object/public/product-images/p/1.webp');
```

- [ ] **Step 2: Correr** `npm test -- src/lib` → FAIL (módulos no existen).
- [ ] **Step 3: Implementar** las funciones con las firmas de arriba. `formatBs` con lógica propia (no depender de que el runtime tenga datos de locale `es-BO`). `normalizeSearch` con `normalize('NFD')` y quitando marcas diacríticas. `buildWhatsAppLink` deja solo dígitos del teléfono.
- [ ] **Step 4: Correr** `npm test -- src/lib` → PASS.
- [ ] **Step 5: Commit** `feat: utilidades de dinero, etiquetas, búsqueda, WhatsApp e imágenes`.

---

### Task 3: Supabase local, esquema del catálogo y RLS

**Files:**
- Create: `supabase/config.toml` (via `npx supabase init`), `supabase/migrations/20261018000001_catalogo.sql`, `supabase/tests/catalogo_rls.test.sql`, `src/lib/supabase/database.types.ts` (generado)
- Modify: `.github/workflows/ci.yml` (quitar `continue-on-error` del job `db`), `package.json` (script `db:types`)

**Interfaces:**
- Produces (tablas, todas con RLS activado):
  - `profiles(id uuid pk → auth.users on delete cascade, full_name text, phone text, role text not null default 'customer' check (role in ('customer','admin')), created_at timestamptz default now())` + trigger `on_auth_user_created` que inserta el perfil.
  - `categories(id uuid pk default gen_random_uuid(), name text not null, slug text unique not null, sort_order int not null default 0, created_at)`
  - `products(id uuid pk, name text not null, slug text unique not null, description text, category_id uuid not null → categories on delete restrict, price_cents int not null check (>= 0), compare_at_cents int check (compare_at_cents is null or compare_at_cents > price_cents), min_age smallint check (min_age between 0 and 99), min_players smallint check (>= 1), max_players smallint check (max_players is null or max_players >= min_players), stock int not null default 0 check (>= 0), is_new bool not null default false, is_active bool not null default true, is_sample bool not null default false, search_text text generated always as (immutable_unaccent(lower(name || ' ' || coalesce(description, '')))) stored, created_at, updated_at)` + índice trigram (`pg_trgm`) sobre `search_text`, trigger que actualiza `updated_at`.
  - `product_images(id uuid pk, product_id uuid not null → products on delete cascade, path text not null, alt text, sort_order int not null default 0)`
  - `store_settings(id smallint pk default 1 check (id = 1), store_name text not null, tagline text, whatsapp_phone text, address text, pickup_hours text, updated_at)` — una sola fila.
  - Funciones: `immutable_unaccent(text) returns text immutable` (envuelve `unaccent` con diccionario explícito), `is_admin() returns boolean` (security definer, `stable`, lee `profiles.role` de `auth.uid()`), `delete_sample_products() returns int` (solo admin; borra `is_sample = true`; devuelve cuántos).
  - Bucket de Storage `product-images` público para lectura; escritura solo admin.
- Políticas: `anon` y `authenticated` leen `categories`, `store_settings`, `products` con `is_active`, y `product_images` de productos activos. Admin (`is_admin()`) puede todo en esas tablas. Cada usuario lee y actualiza su propio `profiles` salvo la columna `role`; admin lee todos.

- [ ] **Step 1: `npx supabase init`** y `npx supabase start` (Docker). Verificar: `npx supabase status` muestra API URL y anon key.
- [ ] **Step 2: Escribir la prueba pgTAP que falla** `supabase/tests/catalogo_rls.test.sql` (crea sus propios datos dentro de la transacción) con estas aserciones:
  - `has_table` para las cinco tablas; RLS activo en las cinco.
  - Como `anon`: ve 1 producto activo y 0 inactivos; `insert` en `products` lanza error de RLS; `update` de `store_settings` afecta 0 filas.
  - Como `authenticated` no admin: no puede cambiar su propio `role` a `admin` (error o 0 filas).
  - Como admin: puede insertar un producto; `delete_sample_products()` devuelve el número de productos de prueba creados y no toca los demás.
  - Como no admin: `delete_sample_products()` lanza error.
  - Restricciones: `insert` con `max_players < min_players` y con `compare_at_cents <= price_cents` fallan.
  - `search_text` de "Catán Junior" es `catan junior`.
- [ ] **Step 3: Correr** `npm run db:test` → FAIL (tablas no existen).
- [ ] **Step 4: Escribir la migración** `20261018000001_catalogo.sql` con las extensiones `unaccent` y `pg_trgm` y todo lo listado en Interfaces.
- [ ] **Step 5: Aplicar y correr** `npx supabase db reset && npm run db:test` → PASS.
- [ ] **Step 6: Generar tipos** `npm run db:types` (`supabase gen types typescript --local > src/lib/supabase/database.types.ts`).
- [ ] **Step 7: Commit** `feat(db): esquema del catálogo con RLS y pruebas pgTAP`; verificar job `db` de CI verde.

---

### Task 4: Datos de prueba

**Files:**
- Create: `supabase/seed.sql`, `public/samples/*.svg` (una ilustración por producto de prueba + `placeholder.svg`)

**Interfaces:**
- Consumes: tablas de la Tarea 3.
- Produces: 6 categorías con estos `slug` y `sort_order`: `estrategia` (Estrategia), `clasicos-familia` (Clásicos en familia), `cartas` (Cartas), `casino` (Casino), `destreza-canchitas` (Destreza y canchitas), `cubos-rompecabezas` (Cubos y rompecabezas); fila de `store_settings` con `store_name 'Ludiq'`, `tagline 'Juegos de mesa para pensar y compartir'`, `whatsapp_phone '+59170000000'` (relleno), `address 'La Paz, Bolivia'`, `pickup_hours 'Lun a Sáb, 10:00–19:00'`; 18 productos con `is_sample = true`, al menos 2 por categoría, incluyendo: uno con `stock = 0`, uno con `stock = 2`, uno con `compare_at_cents` (oferta), dos con `is_new`, uno sin imágenes, uno con nombre de más de 60 caracteres, uno inactivo (`is_active = false`). Precios realistas en Bs (ej. Cubo 3x3 Bs 60, Ajedrez de madera Bs 120, Catán Bs 450, UNO Bs 35, Monopolio Bs 280, Mini canchita Bs 180).

- [ ] **Step 1: Escribir prueba pgTAP que falla** en `supabase/tests/seed.test.sql`: hay 6 categorías; cada categoría tiene ≥ 2 productos activos; existe exactamente 1 producto activo con `stock = 0`; existe 1 producto activo sin filas en `product_images`; `store_settings` tiene 1 fila.
- [ ] **Step 2: Correr** `npx supabase db reset && npm run db:test` → FAIL.
- [ ] **Step 3: Escribir `seed.sql`** y las ilustraciones SVG (simples, planas, con la paleta del cubo sobre fondo crema; `path` de las imágenes = `/samples/<slug>.svg`).
- [ ] **Step 4: Correr** `npx supabase db reset && npm run db:test` → PASS.
- [ ] **Step 5: Commit** `feat(db): datos de prueba del catálogo`.

---

### Task 5: Acceso a datos del catálogo

**Files:**
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/features/catalog/types.ts`, `filters.ts`, `filters.test.ts`, `queries.ts`, `queries.int.test.ts`
- Create (si el adaptador de sesión lo requiere en Next 16): `src/proxy.ts` (antes `middleware.ts`) según la guía oficial actual de Supabase para Next.js con `@supabase/ssr`.

**Interfaces:**
- Consumes: `normalizeSearch`, `escapeLike`, `bsToCents`, `productImageUrl` (Tarea 2); tablas (Tarea 3).
- Produces:
  - `createServerSupabase(): Promise<SupabaseClient<Database>>` (server.ts) · `createBrowserSupabase(): SupabaseClient<Database>` (client.ts)
  - `type CatalogSort = 'destacados' | 'precio_asc' | 'precio_desc' | 'nuevos'`
  - `type CatalogFilters = { categoria?: string; q?: string; precioMin?: number; precioMax?: number; edad?: number; jugadores?: number; ofertas?: true; orden: CatalogSort }` (precios en Bs; `ofertas` viene de `?ofertas=1`)
  - `parseCatalogFilters(sp: Record<string, string | string[] | undefined>): CatalogFilters`
  - `type ProductCardData = { id: string; slug: string; name: string; categoryName: string; priceCents: number; compareAtCents: number | null; minAge: number | null; minPlayers: number | null; maxPlayers: number | null; inStock: boolean; isNew: boolean; imageUrl: string }`
  - `type ProductDetail = ProductCardData & { description: string | null; stock: number; images: { url: string; alt: string }[]; categorySlug: string }`
  - `type Category = { id: string; name: string; slug: string }`
  - `listCategories(): Promise<Category[]>` (por `sort_order`)
  - `listProducts(f: CatalogFilters, limit?: number): Promise<ProductCardData[]>`
  - `getProductBySlug(slug: string): Promise<ProductDetail | null>` (`null` si no existe o está inactivo)
  - `getStoreSettings(): Promise<{ storeName: string; tagline: string | null; whatsappPhone: string | null; address: string | null; pickupHours: string | null }>`
- Semántica de filtros: `edad = n` ⇒ `min_age is null or min_age <= n`; `jugadores = n` ⇒ `(min_players is null or min_players <= n) and (max_players is null or max_players >= n)`; `q` ⇒ `search_text ilike '%' || escapeLike(normalizeSearch(q)) || '%'`; `ofertas` ⇒ `compare_at_cents is not null`; `destacados` ⇒ `is_new desc, created_at desc` (el plan 5 lo cambiará a "más vendidos"); los agotados van al final en todos los órdenes.

- [ ] **Step 1: Escribir pruebas unitarias que fallan** `filters.test.ts`:

```ts
expect(parseCatalogFilters({})).toEqual({ orden: 'destacados' });
expect(parseCatalogFilters({ categoria: 'cartas', q: 'uno', precio_min: '20', precio_max: '100', edad: '8', jugadores: '4', orden: 'precio_asc' }))
  .toEqual({ categoria: 'cartas', q: 'uno', precioMin: 20, precioMax: 100, edad: 8, jugadores: 4, orden: 'precio_asc' });
expect(parseCatalogFilters({ precio_min: 'abc', jugadores: '-3', edad: '200', orden: 'raro', q: '   ' }))
  .toEqual({ orden: 'destacados' });
expect(parseCatalogFilters({ precio_min: '100', precio_max: '20' })).toEqual({ orden: 'destacados', precioMin: 20, precioMax: 100 }); // se invierten
expect(parseCatalogFilters({ categoria: ['a', 'b'] })).toEqual({ categoria: 'a', orden: 'destacados' });
expect(parseCatalogFilters({ ofertas: '1' })).toEqual({ ofertas: true, orden: 'destacados' });
expect(parseCatalogFilters({ ofertas: 'si' })).toEqual({ orden: 'destacados' });
```

- [ ] **Step 2: Escribir pruebas de integración que fallan** `queries.int.test.ts` (contra Supabase local con el seed):
  - `listCategories()` devuelve 6 en el orden del seed.
  - `listProducts({ orden: 'destacados' })` no incluye el producto inactivo; el agotado aparece último con `inStock: false`.
  - `listProducts({ q: 'CATAN', orden: 'destacados' })` y `{ q: 'catán' }` encuentran "Catán"; `{ q: '50%' }` y `{ q: "o'neil" }` devuelven `[]` sin lanzar.
  - `{ categoria: 'no-existe' }` devuelve `[]` sin lanzar.
  - `{ jugadores: 1 }` no incluye productos con `min_players >= 2`.
  - `{ precioMin: 100, precioMax: 200 }` solo trae precios entre 10000 y 20000 centavos.
  - `{ ofertas: true }` solo trae productos con `compareAtCents !== null`.
  - El producto sin imágenes tiene `imageUrl === '/samples/placeholder.svg'`.
  - `getProductBySlug(<slug inactivo>)` y `getProductBySlug('nada')` devuelven `null`.
- [ ] **Step 3: Correr** `npm test -- filters && npm run test:int` → FAIL.
- [ ] **Step 4: Implementar** clientes Supabase según la guía oficial de `@supabase/ssr` para la versión de Next instalada, `parseCatalogFilters` (enteros positivos; `edad` 0–99; `jugadores` 1–20; precios ≥ 0) y las consultas (un solo `select` con `categories(name, slug)` y `product_images(path, alt, sort_order)` embebidos).
- [ ] **Step 5: Correr** `npm test -- filters && npm run test:int` → PASS.
- [ ] **Step 6: Commit** `feat(catalogo): acceso a datos y filtros`.

---

### Task 6: Sistema de diseño (tokens, fuentes, componentes base)

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`
- Create: `components.json` (shadcn), `src/components/ui/button.tsx`, `badge.tsx`, `sheet.tsx`, `input.tsx`, `select.tsx` (vía `npx shadcn add`), `src/components/ui/badge.test.tsx`

**Interfaces:**
- Produces: tokens Tailwind (`@theme`) `--color-crema`, `--color-crema-2`, `--color-tinta`, `--color-madera`, `--color-verde`, `--color-verde-2`, `--color-mostaza`, `--color-rojo`, `--color-cubo-{rojo,crema,verde,mostaza,naranja,azul}`, `--font-serif` (Fraunces), `--font-sans` (Inter), mapeados a las variables de shadcn (`--primary` = verde, `--background` = crema, `--foreground` = tinta, `--destructive` = rojo). `Button` variantes `default` (verde, hover verde-2 y elevación 2px), `outline` (borde y texto madera), `ghost`. `Badge` variantes `nuevo` (verde), `oferta` (rojo), `agotado` (tinta al 70 %).

- [ ] **Step 1: Prueba que falla** `badge.test.tsx`: `render(<Badge variant="agotado">Agotado</Badge>)` ⇒ texto visible "Agotado" y tiene `data-variant="agotado"`.
- [ ] **Step 2: Correr** `npm test -- badge` → FAIL.
- [ ] **Step 3: `npx shadcn init`** y añadir los componentes; definir tokens y fuentes (`next/font/google`, `display: 'swap'`, subconjunto `latin`); añadir variantes. Regla global en `globals.css`: `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }`. Aplicar `ui-ux-pro-max` para revisar contraste (texto ≥ 4.5:1 sobre crema) y tamaños táctiles (≥ 44 px).
- [ ] **Step 4: Correr** `npm test -- badge` → PASS; `npm run build` sin errores.
- [ ] **Step 5: Commit** `feat(ui): sistema de diseño Ludoteca cálida`.

---

### Task 7: Layout de la tienda (cabecera y pie)

**Files:**
- Create: `src/app/(tienda)/layout.tsx`, `src/components/brand/Logo.tsx`, `src/components/layout/SiteHeader.tsx`, `SiteFooter.tsx`, `e2e/layout.spec.ts`

**Interfaces:**
- Consumes: `getStoreSettings`, `listCategories` (Tarea 5); `buildWhatsAppLink` (Tarea 2).
- Produces: `<Logo storeName />` (mini cubo 3×3 + nombre en Fraunces). Cabecera fija con fondo crema translúcido y `backdrop-blur`; enlaces "Catálogo", "Ajedrez"→`/catalogo?categoria=estrategia`, "Cubos"→`/catalogo?categoria=cubos-rompecabezas`, "Ofertas"→`/catalogo?ofertas=1`; icono de carrito como enlace a `/carrito` sin contador (el plan 2 lo activa). En < 768 px los enlaces pasan a un menú `Sheet`. Pie: nombre, lema, dirección, horario de recojo, botón WhatsApp con mensaje "Hola, tengo una consulta".

- [ ] **Step 1: Prueba e2e que falla** `layout.spec.ts`: en desktop se ve el texto "Ludiq" en el header y el enlace "Catálogo" lleva a `/catalogo`; en mobile el enlace está oculto y aparece tras abrir el botón con `aria-label="Abrir menú"`; el pie tiene un enlace cuyo `href` empieza con `https://wa.me/59170000000`.
- [ ] **Step 2: Correr** `npm run test:e2e -- layout` → FAIL.
- [ ] **Step 3: Implementar** layout, header y footer (Server Components; solo el menú móvil es Client Component).
- [ ] **Step 4: Correr** `npm run test:e2e -- layout` → PASS.
- [ ] **Step 5: Commit** `feat(tienda): cabecera y pie`.

---

### Task 8: Página de inicio

**Files:**
- Create: `src/components/brand/Cube3D.tsx`, `IllimaniLandscape.tsx`, `FloatingPieces.tsx`, `src/features/catalog/CategoryGrid.tsx`, `ProductCard.tsx`, `ProductGrid.tsx`, `e2e/home.spec.ts`
- Modify: `src/app/(tienda)/page.tsx`
- Reference: `docs/superpowers/mockups/estilo-b-v3-illimani.html` (estructura, colores y animaciones aprobadas)

**Interfaces:**
- Consumes: `listCategories`, `listProducts`, `getStoreSettings` (Tarea 5); `formatBs`, `ageLabel` (Tarea 2); `Badge`, `Button` (Tarea 6).
- Produces:
  - `<Cube3D size?: number />` — cubo CSS 3D (6 caras × 9 stickers con los colores del cubo), gira 16 s/vuelta, 5 s al pasar el mouse; `aria-hidden`.
  - `<IllimaniLandscape />` — SVG del boceto (Illimani nevado, laderas con ventanas, cable y 3 cabinas roja/amarilla/verde con `animateMotion` 22 s); `aria-hidden`; con reduced motion las cabinas quedan quietas (sin `animateMotion`, decidido en el cliente con `matchMedia` o `useReducedMotion` de Motion).
  - `<FloatingPieces />` — ♞ ♛ 🎲 flotando.
  - `<CategoryGrid categories />` — 6 tarjetas; ícono que gira al hover; enlace a `/catalogo?categoria=<slug>`.
  - `<ProductCard product: ProductCardData />` — imagen `next/image`, badges (Nuevo / `-NN%` si oferta / Agotado), categoría + edad en versalitas, nombre (máx. 2 líneas con elipsis), precio, precio anterior tachado; hover: sube 6 px, sombra, imagen se inclina en 3D. En dispositivos táctiles (`@media (hover: none)`) no depende del hover. Agotado: imagen al 60 % de opacidad. Toda la tarjeta enlaza a `/producto/<slug>`. Sin botón favorito.
  - `<ProductGrid products />` — 2 columnas < 768 px, 3 en ≥ 768, 4 en ≥ 1200.
- Contenido del inicio: eyebrow "♟ Juegos de mesa · La Paz"; `h1` "El arte de *pensar*, en tu mesa."; párrafo del boceto adaptado a todo el catálogo; botones "Explorar catálogo →" (`/catalogo`) y "Ver ofertas" (`/catalogo?ofertas=1`); franja de confianza "🚌 Envíos a toda Bolivia · 📱 Paga con QR · 🏪 Recojo en tienda"; secciones "Explora por tipo" (CategoryGrid) y "Los más pedidos" (`listProducts({orden:'destacados'}, 8)`); banda verde "Paga fácil con QR" con Yape, Altoke y Yasta.

- [ ] **Step 1: Prueba e2e que falla** `home.spec.ts`:
  - hay un `h1` que contiene "pensar"; 6 enlaces dentro de `[data-testid=category-grid]`; ≥ 4 elementos `[data-testid=product-card]` en "Los más pedidos";
  - con `page.emulateMedia({ reducedMotion: 'reduce' })`, el `animation-name` computado de `[data-testid=cube3d]` es `none`;
  - en el proyecto mobile, `document.documentElement.scrollWidth <= window.innerWidth`.
- [ ] **Step 2: Correr** `npm run test:e2e -- home` → FAIL.
- [ ] **Step 3: Implementar** los componentes trasladando el CSS del boceto a Tailwind/CSS modules; Motion solo para las apariciones al cargar (`initial`/`animate` con retraso escalonado) y respetando `useReducedMotion`. Aplicar `frontend-design` para pulir jerarquía y espaciado.
- [ ] **Step 4: Correr** `npm run test:e2e -- home` → PASS. Revisión visual con capturas (skill `webapp-testing`) en 1280 y 360 px, comparadas con el boceto.
- [ ] **Step 5: Commit** `feat(tienda): página de inicio con cubo 3D y paisaje paceño`.

---

### Task 9: Catálogo con filtros y buscador

**Files:**
- Create: `src/app/(tienda)/catalogo/page.tsx`, `src/features/catalog/CatalogFilters.tsx`, `e2e/catalogo.spec.ts`

**Interfaces:**
- Consumes: `parseCatalogFilters`, `listProducts`, `listCategories` (Tarea 5); `ProductGrid` (Tarea 8).
- Produces: página `/catalogo` (Server Component) que lee `searchParams`. `<CatalogFilters categories current />` (Client Component) actualiza la URL con `router.replace` sin recargar la página; buscador con espera de 300 ms; chips de categoría; controles de precio mín./máx. (Bs), edad del jugador ("¿Qué edad tiene?"), jugadores ("¿Cuántos van a jugar?") y orden (Destacados, Menor precio, Mayor precio, Nuevos). En < 768 px los filtros (menos el buscador y las chips) van en un `Sheet` "Filtros". Botón "Limpiar filtros". Interruptor "Solo ofertas". Contador "N juegos". Estado vacío: "No encontramos juegos con esos filtros" + botón "Limpiar filtros". `<title>`: "Catálogo · {storeName}" o "{Categoría} · {storeName}".

- [ ] **Step 1: Prueba e2e que falla** `catalogo.spec.ts`:
  - `/catalogo` muestra todos los productos activos del seed (17) y el texto "17 juegos";
  - tocar la chip "Cartas" cambia la URL a `categoria=cartas` y todas las tarjetas visibles dicen "Cartas";
  - escribir "catan" en el buscador ⇒ aparece "Catán";
  - `/catalogo?precio_min=abc&jugadores=-3&categoria=no-existe` responde 200 y muestra el estado vacío (la categoría inexistente filtra a vacío) sin error;
  - `/catalogo?q=zzzz` muestra "No encontramos juegos con esos filtros" y "Limpiar filtros" vuelve a 17;
  - el producto sin fotos muestra la imagen `placeholder.svg`;
  - en mobile 360 px: el producto de nombre largo no causa scroll horizontal (`scrollWidth <= innerWidth`) y su título está recortado (`text-overflow` o `line-clamp`).
- [ ] **Step 2: Correr** `npm run test:e2e -- catalogo` → FAIL.
- [ ] **Step 3: Implementar** la página y los filtros.
- [ ] **Step 4: Correr** `npm run test:e2e -- catalogo` → PASS.
- [ ] **Step 5: Commit** `feat(catalogo): página de catálogo con filtros y buscador`.

---

### Task 10: Ficha de producto y 404

**Files:**
- Create: `src/app/(tienda)/producto/[slug]/page.tsx`, `src/app/(tienda)/producto/[slug]/not-found.tsx`, `src/app/not-found.tsx`, `src/features/catalog/ProductGallery.tsx`, `e2e/producto.spec.ts`

**Interfaces:**
- Consumes: `getProductBySlug`, `listProducts`, `getStoreSettings` (Tarea 5); `formatBs`, `ageLabel`, `playersLabel`, `buildWhatsAppLink` (Tarea 2).
- Produces: ficha con galería (miniaturas que cambian la imagen; deslizable en celular), migas "Catálogo / {Categoría}", nombre en Fraunces, precio y anterior tachado, etiquetas de edad y jugadores, disponibilidad ("En stock" / "Últimas N unidades" si `stock <= 3` / "Agotado"), descripción, botón principal "Agregar al carrito" **deshabilitado con el texto "Muy pronto"** (lo activa el plan 2) y deshabilitado "Agotado" si no hay stock, botón "Consultar por WhatsApp" con mensaje `Hola, consulto por el producto "{name}"`, y "También te puede gustar" (4 de la misma categoría, sin el actual). `generateMetadata` con título, descripción y imagen OpenGraph. 404 con "Este juego ya no está disponible" + botón "Ver catálogo".

- [ ] **Step 1: Prueba e2e que falla** `producto.spec.ts`:
  - `/producto/<slug de Catán>` muestra "Catán", "Bs 450" y un enlace WhatsApp cuyo `href` contiene `text=Hola%2C%20consulto%20por%20el%20producto`;
  - el producto agotado muestra "Agotado" y su botón está `disabled`;
  - el producto con `stock = 2` del seed muestra "Últimas 2 unidades";
  - `/producto/<slug inactivo>` y `/producto/no-existe` responden 404 y muestran "Ver catálogo";
  - `<meta property="og:title">` contiene el nombre del producto.
- [ ] **Step 2: Correr** `npm run test:e2e -- producto` → FAIL.
- [ ] **Step 3: Implementar** la ficha, la galería y los 404 (`notFound()` cuando `getProductBySlug` devuelve `null`).
- [ ] **Step 4: Correr** `npm run test:e2e -- producto` → PASS.
- [ ] **Step 5: Commit** `feat(catalogo): ficha de producto y página 404`.

---

### Task 11: SEO, rendimiento y publicación en Netlify

**Files:**
- Create: `src/app/sitemap.ts`, `src/app/robots.ts`, `netlify.toml`, `e2e/seo.spec.ts`
- Modify: `src/app/layout.tsx` (metadata base con `NEXT_PUBLIC_SITE_URL`)

**Interfaces:**
- Consumes: `listProducts`, `listCategories` (Tarea 5).
- Produces: `sitemap.xml` con `/`, `/catalogo`, cada `/catalogo?categoria=<slug>` y cada `/producto/<slug>` activo; `robots.txt` que permite todo y apunta al sitemap.

- [ ] **Step 1: Prueba e2e que falla** `seo.spec.ts`: `/sitemap.xml` responde 200 y contiene `/producto/`; `/robots.txt` contiene `Sitemap:`.
- [ ] **Step 2: Correr** `npm run test:e2e -- seo` → FAIL.
- [ ] **Step 3: Implementar** sitemap, robots y metadata.
- [ ] **Step 4: Correr** `npm run test:e2e -- seo` → PASS.
- [ ] **Step 5: Verificar límites de Netlify** (spec §4): leer la página actual de precios y la de soporte de Next.js de Netlify; anotar en `docs/hosting.md` los límites del plan gratis y cualquier función de Next.js que no conviene usar; si algo de lo construido choca, detenerse y avisar.
- [ ] **Step 6: [Diego] Crear proyecto Supabase en la nube** (plan gratis, región más cercana a Bolivia disponible, p. ej. São Paulo), `npx supabase link`, `npx supabase db push` y cargar `seed.sql` (`npx supabase db reset --linked` solo esta primera vez, base vacía).
- [ ] **Step 7: [Diego] Crear sitio en Netlify** conectado al repo de GitHub (rama de producción `main`, vistas previas de Pull Request activadas), con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` como variables de entorno. `netlify.toml`: `command = "npm run build"`, Node 22.
- [ ] **Step 8: Verificar en producción**: abrir el Pull Request `feat/plan-1-catalogo → main`; en la vista previa de Netlify correr `PLAYWRIGHT_BASE_URL=<url de vista previa> npx playwright test e2e/smoke.spec.ts e2e/home.spec.ts`; Lighthouse móvil de `/` con Rendimiento ≥ 85 y Accesibilidad ≥ 95 (si no se alcanza, anotar las causas en el PR).
- [ ] **Step 9: Revisión final** con `web-design-guidelines` sobre `/`, `/catalogo` y una ficha; corregir lo que marque como error.
- [ ] **Step 10: Commit y merge** `chore: SEO y publicación en Netlify`; CI verde; merge del PR a `main`; confirmar que la URL `*.netlify.app` de producción muestra la tienda.
