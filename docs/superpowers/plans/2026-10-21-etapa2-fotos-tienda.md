# Etapa 2 · Parte 1 — Fotos de la tienda y «Visítanos»

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dueño sube desde el panel fotos del local y de La Paz, cada una con una frase. La portada las muestra en un carrusel tipo postal en lugar del cubo 3D, y más abajo una sección «Visítanos en La Paz» con dirección, horario, «Cómo llegar», WhatsApp y un mapa con pin exacto que solo se carga al tocarlo. Todo sin que la portada se vuelva lenta en el celular.

**Architecture:**
- **Base:** una tabla nueva `store_photos` (lectura pública, escritura de admin, máximo 8 fotos por un trigger). Cuatro columnas nuevas en `store_settings`: `zone`, `maps_url`, `latitude` y `longitude`.
- **Archivos:** se guardan en el bucket público que ya existe, `product-images`, bajo la carpeta `tienda/`, con las mismas políticas y tipos de archivo.
- **Lectura:** la portada lee las fotos y los ajustes en el servidor, con `"use cache"` y el tag del catálogo.
- **Carrusel:** es un componente de cliente propio, con `scroll-snap` y sin librerías.
- **Mapa:** un `<iframe>` que se crea solo al tocar «Ver el mapa».

**Tech Stack:** el del proyecto (Next 16 + Cache Components, Supabase, Tailwind, zod, Vitest, Playwright, pgTAP). **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-21-fotos-tienda-design.md`. Contexto: `docs/PROYECTO.md`.

## Global Constraints

- **Reglas de `CLAUDE.md`:** Node 22, Next 16 (`<Suspense>` para la sesión y los parámetros de búsqueda), `"use cache"` en `src/features/catalog/cached.ts`, RLS en toda tabla nueva, TDD y textos en español.
- **Toda acción que cambie las fotos o la ubicación** llama a `invalidateCatalog()`. En el panel se usan `callAction` y `ConfirmButton` para borrar.
- **Fotos:**
  - se comprimen con `compressProductPhoto` (WebP, lado máximo 1600 px) y se suben a `product-images/tienda/<Date.now()>-<6 letras>.<ext>`;
  - si falla el registro, se borra el archivo;
  - al quitar una foto, también se borra su archivo.
- **Límites (exactos):** 8 fotos; frase de 1 a 80 caracteres; zona de hasta 60.
  - Coordenadas dentro de Bolivia: latitud entre −23 y −9, longitud entre −70 y −57.
- **Textos exactos:**
  - `La tienda puede tener hasta 8 fotos`
  - `Escribe una frase corta`
  - `La frase puede tener hasta 80 letras`
  - `Pega las coordenadas como aparecen en Google Maps, por ejemplo -16.5103, -68.1267`
  - `Pega el enlace de Google Maps que mandas por WhatsApp`
  - `Visítanos en La Paz`, `Cómo llegar`, `WhatsApp`, `Ver el mapa`
- **Rapidez:**
  - solo la primera foto se carga al abrir (`priority`); las demás con `loading="lazy"`;
  - `next/image` con `sizes` del tamaño de la postal;
  - el `<iframe>` del mapa no existe hasta que se toca el botón;
  - **Lighthouse móvil ≥ 85 con 8 fotos**, medido en local.
- **Movimiento:** el carrusel no pasa solo si hay `prefers-reduced-motion`, si `isMotionPaused()` lo indica (escuchando `MOTION_EVENT`) o mientras la persona lo toca o pasa el mouse.
- Rama `feat/fotos-tienda`, PR a `main` y una sola fusión con el visto bueno de Diego. Antes de probar la vista previa, Diego hace `npx supabase db push`.

## Review Focus

1. **Quitar una foto borra también su archivo** en `product-images/tienda/`, y si falla el registro de una subida, no queda un archivo suelto → e2e Tarea 3, que cuenta los archivos de `tienda/` con el cliente de servicio.
2. **Coordenadas pegadas como las da Google Maps:**
   - se aceptan con 6 decimales, con espacios de más o sin espacio después de la coma;
   - se rechazan si usan coma decimal (`-16,5103`) o caen fuera de Bolivia (`16.5, 68.1`).
   
   → unitarias Tarea 2.
3. **Comprador con "reducir movimiento" o que pausó las animaciones:** el carrusel no pasa solo → unitaria `canAutoplay` (Tarea 2) y e2e con `emulateMedia({ reducedMotion: "reduce" })` (Tarea 4).
4. **Tienda sin dirección, sin coordenadas o sin fotos (como el seed):**
   - sin fotos se ve el cubo;
   - «Visítanos» solo aparece si hay dirección;
   - el recuadro del mapa solo aparece si hay coordenadas;
   - nada queda roto.
   
   → e2e `home.spec` (Tarea 4) y unitarias de `directionsHref` (Tarea 2).
5. **Novena foto o frase vacía, incluso llamando a la base directo:** el error lo da la base (trigger y check), no solo la pantalla → pgTAP Tarea 1.

---

## Estructura de archivos

```
supabase/migrations/20261024000001_fotos_tienda.sql · supabase/tests/fotos_tienda.test.sql
src/features/store/location.ts (+ test)        # coordenadas, enlace de Maps, «Cómo llegar», mapa embebido
src/features/store/carousel.ts (+ test)        # nextIndex, canAutoplay, AUTOPLAY_MS
src/features/store/StorePostcard.tsx           # servidor: carrusel o cubo + línea «📍 zona · Cómo llegar»
src/features/store/PhotoCarousel.tsx           # cliente
src/features/store/VisitSection.tsx · MapLoader.tsx (cliente)
src/features/admin/store-photo-actions.ts · src/features/admin/settings/StorePhotosEditor.tsx
modificar: src/features/catalog/queries.ts + cached.ts (getStoreSettings, listStorePhotos)
           src/features/admin/settings-actions.ts + settings/StoreForms.tsx + queries.ts (getSettingsData)
           src/app/panel/ajustes/page.tsx · src/app/(tienda)/page.tsx · e2e/reset-db.mts
e2e: home.spec.ts (sin fotos) · panel-ajustes.spec.ts (fotos y ubicación, solo PC)
scripts/demo-store-photos.mts                  # solo local: 8 fotos de prueba para medir Lighthouse
```

---

### Task 1: Base — fotos de la tienda y ubicación

**Files:**
- Create: `supabase/migrations/20261024000001_fotos_tienda.sql`, `supabase/tests/fotos_tienda.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (`npm run db:types`)

**Interfaces — Produces:**
- **Tabla de fotos:** `store_photos(id uuid pk default gen_random_uuid(), path text not null unique, caption text not null check (char_length(btrim(caption)) between 1 and 80), sort_order int not null default 0, created_at timestamptz not null default now())`.
  - RLS: `select` para `anon, authenticated`; `insert/update/delete` solo con `(select public.is_admin())`.
- **Límite de 8:** trigger `store_photos_limit`, `before insert`. Hace `lock table` o `for update` sobre la cuenta, y con 8 o más fotos devuelve `P0001` `La tienda puede tener hasta 8 fotos`.
- **Columnas nuevas en `store_settings`:**
  - `zone text check (char_length(zone) <= 60)`;
  - `maps_url text check (maps_url ~ '^https://((www\.)?google\.[a-z.]+/maps|maps\.google\.[a-z.]+/|maps\.app\.goo\.gl/|goo\.gl/maps/)')`;
  - `latitude numeric(9,6) check (latitude between -23 and -9)`;
  - `longitude numeric(9,6) check (longitude between -70 and -57)`;
  - `constraint store_settings_coordinates check ((latitude is null) = (longitude is null))`.

- [ ] **Step 1: pgTAP que falla** `fotos_tienda.test.sql` (admin y cliente como en las otras pruebas):
  - **anon:** lee `store_photos`; `insert` como anon o como cliente ⇒ 42501 o 0 filas (política).
  - **admin:**
    - inserta 8 fotos con frase `'Foto n'`;
    - la novena da `La tienda puede tener hasta 8 fotos`;
    - una frase `'   '` o de 81 caracteres viola el check.
  - **`store_settings`:**
    - `latitude = -16.5103` sin `longitude` viola `store_settings_coordinates`;
    - `latitude = 16.5` viola el check;
    - `maps_url = 'https://evil.example/maps'` viola el check;
    - `'https://maps.app.goo.gl/AbC123'` y `'https://www.google.com/maps/place/x'` se aceptan.
- [ ] **Step 2:** `npm run db:test` → FALLA (la tabla no existe).
- [ ] **Step 3:** escribir la migración.
- [ ] **Step 4:** `npx supabase migration up --local`, luego `npm run db:test` → PASA. Después, `npm run db:types` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(base): fotos de la tienda y ubicación en ajustes`.

### Task 2: Lógica de ubicación y del carrusel

**Files:**
- Create: `src/features/store/location.ts`, `src/features/store/location.test.ts`, `src/features/store/carousel.ts`, `src/features/store/carousel.test.ts`

**Interfaces — Produces:**
- **`location.ts`:**
  - `COORDINATES_ERROR` (texto exacto de las Global Constraints);
  - `parseCoordinates(text: string): { latitude: number; longitude: number } | null`;
  - `formatCoordinates(latitude: number, longitude: number): string`, que da `"-16.5103, -68.1267"`;
  - `isGoogleMapsUrl(url: string): boolean`, con la misma regla que el check de la base;
  - `directionsHref(s: { mapsUrl: string | null; latitude: number | null; longitude: number | null; address: string | null }): string | null`:
    - si hay `mapsUrl`, ese enlace;
    - si no, con coordenadas, `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`;
    - si no, con dirección, el mismo con la dirección codificada;
    - si no hay nada, `null`.
  - `mapEmbedSrc(latitude: number, longitude: number): string`, que da `https://www.google.com/maps?q=<lat>,<lng>&z=17&output=embed`.
- **`carousel.ts`:**
  - `AUTOPLAY_MS = 5000`;
  - `nextIndex(current: number, count: number): number` (da la vuelta);
  - `canAutoplay(s: { count: number; reducedMotion: boolean; paused: boolean; interacting: boolean }): boolean`.

- [ ] **Step 1: Unitarias que fallan:**
  - **`parseCoordinates`:**
    - `"-16.5103, -68.1267"`, `"-16.510312,-68.126745"` y `"  -16.5103 ,  -68.1267 "` ⇒ los números;
    - `"-16,5103, -68,1267"`, `"16.5, 68.1"`, `"-16.5103"`, `"abc"` y `""` ⇒ `null`.
  - **`isGoogleMapsUrl`:**
    - verdadero para `https://maps.app.goo.gl/AbC123`, `https://www.google.com/maps/place/Ludiq/@-16.5,-68.1,17z`, `https://maps.google.com/?q=x` y `https://goo.gl/maps/xyz`;
    - falso para `http://maps.app.goo.gl/x`, `https://evil.example/maps` y `https://google.com.evil.io/maps`.
  - **`directionsHref`:**
    - con las cuatro combinaciones (enlace, solo coordenadas, solo dirección `"Calle 1, Sopocachi"` ⇒ `query=Calle%201%2C%20Sopocachi`, y nada ⇒ `null`);
    - y `mapEmbedSrc(-16.5103, -68.1267)` exacto.
  - **`nextIndex`:** `(0, 3)` ⇒ 1 y `(2, 3)` ⇒ 0.
  - **`canAutoplay`:** verdadero solo con `count ≥ 2` y las otras tres banderas en falso; falso con `count` 1 y con cualquier bandera en verdadero.
- [ ] **Step 2:** `npm test -- store` → FALLA.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test` → PASA.
- [ ] **Step 5: Commit** `feat(tienda): lógica de ubicación y del carrusel`.

### Task 3: Panel — fotos de la tienda y datos de ubicación

**Files:**
- Create: `src/features/admin/store-photo-actions.ts`, `src/features/admin/settings/StorePhotosEditor.tsx`
- Modify:
  - `src/features/admin/settings-actions.ts` (`storeInput` y `saveStoreAction`);
  - `src/features/admin/settings/StoreForms.tsx`;
  - `src/features/admin/queries.ts` (`getSettingsData`);
  - `src/app/panel/ajustes/page.tsx`;
  - `e2e/reset-db.mts`;
  - `e2e/panel-ajustes.spec.ts`.

**Interfaces:**
- Consumes: `parseCoordinates`, `formatCoordinates`, `isGoogleMapsUrl` y `COORDINATES_ERROR` (Tarea 2).
- Produces:
  - **`store-photo-actions.ts`** (`"use server"`). Todas las funciones devuelven `Result`, piden `isAdminSession()` y llaman a `invalidateCatalog()`:
    - `addStorePhotoAction(path: string, caption: string)`: el `path` debe empezar con `tienda/`; si falla, borra el archivo y muestra el mensaje `P0001` de la base;
    - `updateStorePhotoCaptionAction(id: string, caption: string)`;
    - `moveStorePhotoAction(id: string, direction: "up" | "down")`: renumera `sort_order` de 0 a n−1;
    - `removeStorePhotoAction(id: string)`: borra la fila y el archivo.
  - **`getSettingsData()`** suma:
    - `storePhotos: { id: string; url: string; caption: string }[]`, ordenadas;
    - en `store`, los campos `zone`, `mapsUrl` y `coordinates` (texto con `formatCoordinates`, o `""`).
  - **`storeInput`** suma:
    - `zone`: hasta 60;
    - `mapsUrl`: vacío o `isGoogleMapsUrl`; si no, el mensaje exacto del enlace;
    - `coordinates`: vacío ⇒ las dos en `null`; si no, `parseCoordinates` o `COORDINATES_ERROR`.

**Pantalla:**
- **En Ajustes,** una sección nueva `fotos` («Fotos de la tienda»), después de «Tienda», con la ayuda: `Se muestran en la portada como postal. Hasta 8, cada una con una frase corta.`
- **`StorePhotosEditor`:**
  - **Agregar:** un formulario con «Elegir foto» (cámara o galería, como `PhotoManager`), «Frase» (`maxLength` 80) y «Subir foto». Se deshabilita con 8 fotos y muestra `La tienda puede tener hasta 8 fotos`.
  - **La lista:** cada foto con su miniatura, la frase editable con «Guardar», «Subir» y «Bajar» (con `aria-label`), y «Quitar» con confirmación.
- **En `StoreForm`,** tres campos nuevos: `Zona (ej.: Sopocachi)`, `Enlace de Google Maps` y `Coordenadas`. Debajo de «Coordenadas» va la ayuda: `En Google Maps, mantén el dedo sobre la tienda y copia los números que aparecen arriba.`
- **`reset-db.mts`:**
  - borra `store_photos` y los archivos de `product-images` bajo `tienda/` (con `storage/v1/object/list` y `remove`);
  - deja `zone`, `maps_url`, `latitude` y `longitude` en `null`.

- [ ] **Step 1: e2e que falla** en `e2e/panel-ajustes.spec.ts` (solo PC):
  - **`el dueño sube, ordena y quita fotos de la tienda`:**
    - subir sin frase ⇒ `Escribe una frase corta`;
    - subir `e2e/fixtures/captura.png` con `Nuestra vitrina` y después con `El Illimani desde la tienda`;
    - la lista muestra las dos en ese orden;
    - «Subir» en la segunda las invierte;
    - «Quitar» en las dos deja la lista vacía;
    - con el cliente de servicio, `product-images` no tiene archivos bajo `tienda/` (Review Focus 1).
  - **`el dueño guarda la ubicación de la tienda`:**
    - las coordenadas `abc` ⇒ `COORDINATES_ERROR`;
    - el enlace `https://evil.example/maps` ⇒ `Pega el enlace de Google Maps que mandas por WhatsApp`;
    - con zona `Sopocachi`, enlace `https://maps.app.goo.gl/AbC123` y coordenadas `-16.5103, -68.1267`, guarda;
    - al recargar, el campo muestra `-16.5103, -68.1267`.
- [ ] **Step 2:** `npx playwright test e2e/panel-ajustes.spec.ts --project=desktop-panel --no-deps` → FALLA.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** el mismo comando → PASA. También `npm run lint` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(panel): fotos de la tienda y ubicación en Ajustes`.

### Task 4: Portada — postal con carrusel y «Visítanos»

**Files:**
- Create: en `src/features/store/`, `StorePostcard.tsx`, `PhotoCarousel.tsx`, `VisitSection.tsx` y `MapLoader.tsx`.
- Modify:
  - `src/features/catalog/queries.ts` y `cached.ts`;
  - `src/app/(tienda)/page.tsx`;
  - `e2e/home.spec.ts`;
  - `e2e/panel-ajustes.spec.ts`.

**Interfaces:**
- Consumes: Tareas 2 y 3.
- Produces:
  - **`getStoreSettings()`** suma `zone`, `mapsUrl`, `latitude` y `longitude`, como `number | null`.
  - **`listStorePhotos(): Promise<{ id: string; url: string; caption: string }[]>`**, en `queries.ts`, con su versión `cached` (`"use cache"`, `cacheLife("minutes")` y `cacheTag(CATALOG_TAG)`). La URL sale de `productImageUrl`.

**Postal (`StorePostcard`, servidor):**
- **Sin fotos:** se dejan exactamente el `Cube3D` y las piezas de hoy.
- **Con fotos:**
  - `PhotoCarousel` dentro de un marco blanco con sombra y `-rotate-2`, con un tamaño fijo que no reacomoda la página: `aspect-[4/3]` y ancho máximo de unos 420 px;
  - la frase debajo de la foto, dentro de la postal.
- **La línea `📍 <zona>, La Paz · Cómo llegar`** (`📍 La Paz · …` sin zona). Solo aparece si `directionsHref` no es `null`.
- **`MotionToggle`** sigue donde está.

**`PhotoCarousel` (cliente):**
- Un contenedor `overflow-x-auto snap-x snap-mandatory` con una diapositiva por foto, cada una como `role="group"` con `aria-roledescription="diapositiva"` y `aria-label="N de M"`. El conjunto va en `section aria-roledescription="carrusel" aria-label="Fotos de la tienda"`.
- **Imágenes:** `next/image` con `fill`, `sizes="(max-width: 768px) 80vw, 420px"` y `alt` = la frase. La primera lleva `priority`; las demás, `loading="lazy"`.
- **Puntitos:** `button` con `aria-label="Ver foto N de M"` y `aria-current` en la activa. No hay puntitos con 1 foto.
- **El índice activo** se calcula con `scrollLeft` del contenedor. El autoplay usa `canAutoplay` y `nextIndex`:
  - lee `matchMedia("(prefers-reduced-motion: reduce)")` y `isMotionPaused()`, y escucha `MOTION_EVENT`;
  - `interacting` se activa con `pointerenter`/`pointerdown` y `focusin`, y se desactiva al salir.

**«Visítanos» (`VisitSection`, servidor):**
- Va después de los destacados, y **solo si hay dirección**.
- `section aria-labelledby` con `h2` `Visítanos en La Paz`, la dirección y `Horario: <pickup_hours>` (si hay).
- **Botones:**
  - `Cómo llegar` (`directionsHref`, `target="_blank"`);
  - `WhatsApp` (`buildWhatsAppLink(whatsapp, "Hola, quiero visitar la tienda")`, si hay número).
- **`MapLoader` (cliente)** solo con coordenadas: un recuadro con el botón `Ver el mapa`. Al tocarlo se reemplaza por `<iframe title="Mapa de Ludiq en La Paz" src={mapEmbedSrc(...)} loading="lazy">` con alto fijo.
- **En la PC,** dos columnas: los datos y botones a un lado, el mapa al otro **[constructor el detalle]**.

- [ ] **Step 1: e2e que fallan:**
  - **`home.spec.ts` (tienda, celular y PC, con el seed)** — `sin fotos la portada muestra el cubo y Visítanos con la dirección`:
    - se ve `getByTestId("cube3d")`;
    - la región `Visítanos en La Paz` contiene `La Paz, Bolivia`;
    - `Cómo llegar` lleva a un `href` que empieza con `https://www.google.com/maps/search/`;
    - no hay botón `Ver el mapa` (el seed no tiene coordenadas).
  - **`panel-ajustes.spec.ts`** — `las fotos y la ubicación aparecen en la portada`:
    - el admin sube 2 fotos y guarda la ubicación (como en la Tarea 3), y después va a `/`;
    - la región `Fotos de la tienda` tiene 2 diapositivas y la primera imagen con `alt` `Nuestra vitrina`;
    - no se ve `cube3d`;
    - el botón `Ver foto 2 de 2` muestra la segunda (`aria-current`);
    - con `emulateMedia({ reducedMotion: "reduce" })` y la página recargada, después de 6 s la activa sigue siendo la 1;
    - `Cómo llegar` lleva a `https://maps.app.goo.gl/AbC123`;
    - antes de tocar `Ver el mapa` no hay `iframe`; después, su `src` contiene `q=-16.5103,-68.1267`;
    - al final, quitar las fotos y vaciar la ubicación desde el panel; `/` vuelve a mostrar `cube3d`.
- [ ] **Step 2:** `npx playwright test e2e/home.spec.ts e2e/panel-ajustes.spec.ts --project=desktop --project=desktop-panel --no-deps` → FALLA.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** el mismo comando → PASA. Luego `--project=mobile` para `home.spec.ts`, más `npm run lint` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(tienda): postal con fotos y sección Visítanos en la portada`.

### Task 5: Rapidez medida y cierre

**Files:**
- Create: `scripts/demo-store-photos.mts`
- Modify: `docs/PROYECTO.md`, `docs/contexto/repomix-proyecto.xml`

**`scripts/demo-store-photos.mts`:**
- Corre **solo contra Supabase local** (la misma guarda que `reset-db.mts`).
- Genera 8 imágenes WebP de 1600 × 1200, por ejemplo con Playwright: hace una captura de una página de colores y la convierte.
- Las sube a `product-images/tienda/demo-*.webp`, crea las filas de `store_photos` con frases de ejemplo y deja la ubicación de prueba.
- Con `--clean`, quita todo.

- [ ] **Step 1:** `node scripts/demo-store-photos.mts`, luego `npm run build && npm run start`, y medir con Lighthouse en modo móvil:

  ```
  CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())") \
    npx -y lighthouse@12.8.2 http://localhost:3000/ --only-categories=performance --form-factor=mobile --quiet --output=json --output-path=<workspace>/lh.json
  ```

  **Esperado:** `categories.performance.score ≥ 0.85` y CLS ≤ 0,1. Medir también **sin fotos** (con `--clean`) y anotar las dos cifras.
  - Si queda por debajo de 0,85, revisar `sizes`, `priority` y `lazy` antes de seguir.
  - Si Lighthouse no se puede descargar, anotar un Ruling y medir el peso de la primera carga en la pestaña de red de Playwright: la primera foto pesa menos de 150 KB y las demás no se piden al abrir.
- [ ] **Step 2:** `node scripts/demo-store-photos.mts --clean`.
- [ ] **Step 3: Suite completa:** `npm test`, `npm run test:int`, `npm run db:test`, `npm run lint`, `npm run typecheck` y `npm run test:e2e` → todo PASA.
- [ ] **Step 4: Docs.**
  - En `docs/PROYECTO.md`:
    - estado: Etapa 2, parte 1, en la rama, con la migración `20261024000001`;
    - Plan 5 en producción (PR #6);
    - modelo: `store_photos` y la ubicación en `store_settings`;
    - las cifras de Lighthouse.
  - Después, `npx repomix`.
- [ ] **Step 5: Commit** `feat: fotos de la tienda medidas y documentadas`.

**Después de la Tarea 5:**
- Diego hace `npx supabase db push`.
- Prueba la vista previa del PR: sube una foto propia desde el panel y pega las coordenadas de la tienda.
- Si no quiere que esa foto quede, la quita.
- Al final, se fusiona con su visto bueno.
