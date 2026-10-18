# Plan 2 — Cuentas, carrito y compra con QR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un comprador puede armar su carrito sin cuenta, crear su cuenta o entrar, elegir la forma de entrega (con zonas y puntos de encuentro), pedir factura si quiere, pagar con QR subiendo la captura y seguir el estado de sus pedidos; los pedidos quedan en la base listos para que el dueño los atienda en el plan 3.

**Architecture:** El carrito vive en `localStorage` (sobrevive al login en el mismo navegador). Todo lo que cambia un pedido pasa por **funciones de Postgres** (`security definer`) que validan estado, dueño, stock y precios del lado de la base; el navegador nunca escribe directamente en `orders`. La sesión de Supabase va en cookies con `@supabase/ssr`; `src/proxy.ts` la refresca y protege `/checkout` y `/pedidos`. Las capturas van a un bucket **privado** y se muestran con URLs firmadas.

**Tech Stack:** lo del plan 1 + Supabase Auth (correo/contraseña y Google), Server Actions de Next 16, `pg_cron`, `zod` (validación compartida), `browser-image-compression` (comprimir capturas).

**Spec:** `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md` (§5.3, §5.4; contexto §4 y §5.6). Hoja de ruta: `docs/superpowers/plans/README.md`. Lecciones del plan 1: memoria `estado-plan1`.

**Decisión que se aparta del spec (§5.4, Stock):** el spec dice que el stock se descuenta "al enviar el pedido". Pero el código del pedido debe existir *antes* de pagar (va en la glosa), así que el pedido se crea al pasar al pago, en el estado interno `esperando_pago`, y **ahí se reserva el stock**; si en 60 minutos no sube la captura, se cancela solo y el stock vuelve. Así nadie paga por la última unidad que otro se llevó mientras pagaba. Ese estado no aparece en las listas del dueño (plan 3).

**Nota para Diego:** *Server Action* ≈ un controlador de Laravel al que el formulario llama directo, sin escribir la API; *función RPC de Postgres* ≈ un "service" transaccional que vive en la base (como un `DB::transaction` que nadie puede saltarse).

## Global Constraints

- Todo lo del plan 1 sigue vigente: Node 22, español, `Bs` en centavos (`formatBs`), paleta Ludoteca cálida, sin funciones exclusivas de Vercel, rutas en español.
- **Next 16 + Cache Components:** cualquier lectura de `cookies()`, `params` o `searchParams` va dentro de `<Suspense>` (si no, Netlify responde 500). Las páginas con sesión **no** usan `"use cache"`; los datos públicos siguen saliendo de `src/features/catalog/cached.ts`.
- Leer la guía en `node_modules/next/dist/docs/` antes de usar `proxy.ts`, Server Actions, `redirect` o `cookies` (AGENTS.md).
- Estados del pedido (enum `order_status`), exactos: `esperando_pago`, `en_revision`, `pagado`, `enviado`, `listo_para_recoger`, `entregado`, `rechazado`, `cancelado`, `reembolsado`. Etiquetas visibles: "Esperando tu pago", "En revisión", "Pagado", "Enviado", "Listo para recoger", "Entregado", "Rechazado", "Cancelado", "Reembolsado".
- Formas de entrega (enum `delivery_method`): `recojo`, `envio_ciudad`, `encomienda`. Modo de zona (enum `zone_mode`): `domicilio`, `punto`.
- Código de pedido visible: `#` + número con 4 dígitos (`#0231`); el comprador lo pone en la glosa del pago.
- Departamentos (exactos, en este orden): La Paz, Cochabamba, Santa Cruz, Oruro, Potosí, Chuquisaca, Tarija, Beni, Pando.
- Encomienda: el costo del pasaje lo paga el comprador al recoger; mostrar siempre "El envío por bus se paga al recoger la encomienda (por pagar)".
- Capturas: bucket privado `payment-proofs`, ruta `<user_id>/<order_id>/<timestamp>.<ext>`; solo imágenes; máx. 10 MB antes de comprimir; se comprimen a WebP de lado máximo 1600 px.
- Precios y totales los calcula **la base**; lo que manda el navegador es solo una estimación para mostrar.
- Plazos: pedido `esperando_pago` sin captura → se cancela a los **60 minutos**; `rechazado` sin nueva captura → se cancela a las **48 horas**; ambos devuelven el stock. `en_revision` nunca vence (el panel del plan 3 resalta >24 h).
- Teléfono: celular boliviano de 8 dígitos que empieza con 6 o 7 (se acepta con `+591` y espacios). CI: 5–10 dígitos, con complemento y extensión opcionales (`1234567`, `1234567-1A`, `1234567 LP`). NIT: 5–13 dígitos.
- Créditos de Netlify: trabajar en `feat/plan-2-compra`, probar en la vista previa del PR y fusionar una sola vez al final.

## Review Focus

1. **Dos compradores por la última unidad** ⇒ solo uno crea el pedido; el otro ve "Ya no queda stock suficiente de «Jenga»" y su carrito se ajusta → pgTAP en Tarea 2 + e2e en Tarea 6.
2. **El precio cambió o el producto se ocultó entre el carrito y el pago** ⇒ la base cobra el precio actual y rechaza productos inactivos con un mensaje que nombra el producto → pgTAP en Tarea 2 + e2e en Tarea 6.
3. **Captura rara** (PDF, foto de 15 MB, archivo vacío) ⇒ no-imagen y >10 MB se rechazan con mensaje claro antes de subir; una foto grande válida se comprime → unitarias en Tarea 7 + e2e.
4. **Doble toque en "Continuar al pago" o volver atrás y reenviar** ⇒ un solo pedido (clave de idempotencia `request_id`) → pgTAP en Tarea 2 + e2e en Tarea 6.
5. **Enlace a un pedido ajeno o sesión vencida** ⇒ pedido ajeno muestra "no encontrado" (nunca datos de otro); sin sesión redirige a `/ingresar?siguiente=…` y vuelve después → pgTAP en Tarea 1 + e2e en Tareas 4 y 8.

---

## Estructura de archivos

```
supabase/migrations/20261019000001_pedidos.sql      # tablas, enums, RLS, buckets, datos base de entrega
supabase/migrations/20261019000002_pedidos_rpc.sql  # create_order, submit_payment_proof, cancel_order_by_customer, expire_orders, pg_cron
supabase/tests/pedidos_rls.test.sql · pedidos_rpc.test.sql
public/samples/qr-yape.svg · qr-altoke.svg · qr-yasta.svg
src/proxy.ts                                        # refresca sesión y protege rutas
src/lib/supabase/proxy-session.ts                   # updateSession(request)
src/features/auth/  actions.ts · AuthForm.tsx · UserMenu.tsx · session.ts
src/app/(tienda)/ingresar · registro · recuperar · nueva-clave /page.tsx
src/app/auth/confirm/route.ts · src/app/auth/callback/route.ts
src/features/cart/  cart-store.ts · useCart.ts · AddToCartButton.tsx · CartBadge.tsx · CartView.tsx
src/app/(tienda)/carrito/page.tsx                   # reemplaza la página provisional
src/features/checkout/  schema.ts · delivery.ts · CheckoutForm.tsx · actions.ts · queries.ts
src/app/(tienda)/checkout/page.tsx
src/features/orders/  status.ts · queries.ts · actions.ts · PaymentStep.tsx · ProofUploader.tsx · compress.ts · OrderTimeline.tsx
src/app/(tienda)/pedidos/page.tsx · pedidos/[id]/page.tsx · pedidos/[id]/pago/page.tsx
e2e/helpers/supabase-admin.ts                       # solo local: service role para preparar estados
e2e/auth.spec.ts · carrito.spec.ts · checkout.spec.ts · pago.spec.ts · pedidos.spec.ts
```

---

### Task 1: Esquema de pedidos, entrega y pagos con RLS

**Files:**
- Create: `supabase/migrations/20261019000001_pedidos.sql`, `supabase/tests/pedidos_rls.test.sql`, `public/samples/qr-{yape,altoke,yasta}.svg`
- Modify: `src/lib/supabase/database.types.ts` (regenerar)

**Interfaces:**
- Produces (todas con RLS):
  - Enums `order_status`, `delivery_method`, `zone_mode` (valores en Global Constraints).
  - `store_settings` + columnas `delivery_fee_home_cents int not null default 1500`, `delivery_fee_meeting_cents int not null default 0` (≥ 0).
  - `delivery_zones(id uuid pk, name text not null unique, mode zone_mode not null, is_active bool default true, sort_order int default 0)`.
  - `meeting_points(id uuid pk, name text not null, reference text, is_active bool default true, sort_order int default 0)`.
  - `payment_methods(id uuid pk, name text not null, qr_path text not null, account_holder text, is_active bool default true, sort_order int default 0)`.
  - `orders(id uuid pk, number int generated by default as identity unique, request_id uuid not null unique, customer_id uuid not null → profiles, status order_status not null default 'esperando_pago', delivery_method delivery_method not null, zone_id uuid → delivery_zones, zone_mode zone_mode, address text, address_reference text, meeting_point_id uuid → meeting_points, meeting_point_custom text, recipient_name text not null, recipient_ci text, phone text not null, department text, city text, invoice_requested bool not null default false, invoice_nit text, invoice_name text, subtotal_cents int not null, delivery_fee_cents int not null, total_cents int not null, rejection_reason text, shipping_agency text, tracking_code text, created_at, submitted_at timestamptz, status_changed_at timestamptz not null default now(), updated_at)` + checks: `total_cents = subtotal_cents + delivery_fee_cents`; si `invoice_requested` entonces NIT y razón social no nulos.
  - `order_items(id uuid pk, order_id → orders on delete cascade, product_id → products on delete restrict, product_name text not null, unit_price_cents int not null, quantity int not null check (quantity between 1 and 20))`.
  - `order_events(id bigint identity pk, order_id → orders cascade, from_status order_status, to_status order_status not null, actor text not null check (actor in ('cliente','admin','sistema')), note text, created_at)`.
  - `payment_proofs(id uuid pk, order_id → orders cascade, path text not null unique, created_at)`.
  - Bucket `payment-proofs` **privado** (`file_size_limit` 5 MB, `allowed_mime_types` `image/*`); bucket `store-assets` público para QR (escritura admin).
- Políticas: lectura pública de zonas, puntos y billeteras **activos**; cliente lee **solo** sus `orders`, `order_items`, `order_events`, `payment_proofs`; **nadie salvo admin** inserta/actualiza `orders` u `order_items` directamente (los cambios pasan por las RPC de la Tarea 2); en `storage.objects` de `payment-proofs`: el cliente sube solo bajo `<su uid>/<id de un pedido suyo en esperando_pago o rechazado>/` y lee solo lo suyo; admin lee todo.
- **Datos base de entrega en la migración** (no en el seed: son configuración real que el dueño editará en el plan 3, y así llegan a la nube con `db push`), con `on conflict do nothing`: zonas `Sopocachi`, `Miraflores`, `San Miguel`, `Centro`, `Calacoto`, `Achumani` (domicilio) y `El Alto`, `Villa Fátima`, `Pampahasi`, `Chasquipampa` (punto); puntos `Teleférico Rojo – estación Central`, `Teleférico Amarillo – estación Sopocachi`, `Plaza del Estudiante`, `Plaza Murillo`, `UMSA – Monoblock Central`; billeteras Yape, Altoke, Yasta con `qr_path` `/samples/qr-*.svg`; tarifas 15 Bs domicilio / 0 Bs punto.

- [ ] **Step 1: Crear rama** `git checkout main && git pull && git checkout -b feat/plan-2-compra`; abrir PR borrador a `main` para que corra CI.
- [ ] **Step 2: pgTAP que falla** `pedidos_rls.test.sql` (dos clientes A y B y un admin creados en la prueba; un pedido de A insertado como postgres):
  - A ve su pedido, sus items y eventos; B ve 0 filas de los de A.
  - A no puede `insert` ni `update` en `orders` (42501), ni cambiar `status` de su pedido.
  - anon ve 10 zonas, 5 puntos y 3 billeteras activas; una zona `is_active=false` no aparece.
  - A puede insertar en `storage.objects` (`bucket_id='payment-proofs'`, `name='<uid A>/<pedido de A>/1.webp'`); falla con `name='<uid B>/…'` y con el pedido de A en estado `pagado`; B no puede leer el objeto de A; admin sí.
  - Check `total_cents = subtotal + fee` y factura sin NIT fallan con 23514.
- [ ] **Step 3: Correr** `npx supabase db reset && npm run db:test` → FAIL.
- [ ] **Step 4: Migración** como en Interfaces; QR de relleno en SVG con la palabra de la billetera.
- [ ] **Step 5: Correr** `npx supabase db reset && npm run db:test` → PASS (incluye las pruebas del plan 1); `npm run db:types`.
- [ ] **Step 6: Commit** `feat(db): esquema de pedidos, entrega y pagos con RLS`.

---

### Task 2: Funciones de pedido (crear, pagar, cancelar, vencer)

**Files:**
- Create: `supabase/migrations/20261019000002_pedidos_rpc.sql`, `supabase/tests/pedidos_rpc.test.sql`

**Interfaces:**
- Consumes: tablas de la Tarea 1.
- Produces (todas `security definer`, `search_path = ''`, `execute` solo para `authenticated` salvo `expire_orders`):
  - `create_order(p_request_id uuid, p_items jsonb, p_delivery jsonb, p_invoice jsonb) returns table (order_id uuid, order_number int)`
    - `p_items`: `[{"product_id": uuid, "quantity": int}]` (1–30 líneas, cantidad 1–20, sin repetidos).
    - `p_delivery`: `{"method": "recojo"|"envio_ciudad"|"encomienda", "recipient_name", "phone", "zone_id"?, "address"?, "address_reference"?, "meeting_point_id"?, "meeting_point_custom"?, "recipient_ci"?, "department"?, "city"?}`.
    - `p_invoice`: `{"requested": bool, "nit"?, "name"?}`.
    - Si ya existe un pedido con ese `p_request_id` **del mismo cliente**, devuelve ese mismo pedido (idempotente).
    - Bloquea los productos (`select … for update`), valida activos y stock, toma **el precio de la base**, descuenta stock, calcula envío (`recojo`→0; `envio_ciudad`→tarifa domicilio o punto según `zone.mode`; `encomienda`→0), inserta pedido en `esperando_pago`, items y evento (`actor 'cliente'`).
    - Errores con `errcode 'P0001'` y mensaje legible para el comprador: `Ya no queda stock suficiente de «<nombre>»`, `«<nombre>» ya no está disponible`, `Elige una zona de envío`, `Elige un punto de encuentro o escribe uno`, `Falta el CI de quien recoge la encomienda`, etc.
  - `submit_payment_proof(p_order_id uuid, p_path text) returns void` — solo el dueño del pedido, solo en `esperando_pago` o `rechazado`, `p_path` debe empezar por `<auth.uid()>/<p_order_id>/` y existir en `storage.objects`; inserta en `payment_proofs`, pasa a `en_revision`, fija `submitted_at` (primera vez), limpia `rejection_reason`, registra evento.
  - `cancel_order_by_customer(p_order_id uuid) returns void` — solo el dueño, solo en `esperando_pago` o `rechazado`; devuelve stock; evento.
  - `expire_orders(p_now timestamptz default now()) returns int` — cancela `esperando_pago` con `status_changed_at < p_now - 60 min` y `rechazado` con `< p_now - 48 h`, devuelve stock, evento `actor 'sistema'` con nota `Venció sin pago` / `Venció sin nueva captura`; devuelve cuántos. Programado con `cron.schedule('vencer-pedidos', '*/10 * * * *', 'select public.expire_orders()')`.
  - Trigger que mantiene `status_changed_at` y `updated_at`.

- [ ] **Step 1: pgTAP que falla** `pedidos_rpc.test.sql` (productos de prueba propios con stock controlado):
  - Pedido de 2 unidades (stock 5) ⇒ stock 3, total = precios de la base + tarifa; `order_number` > 0; estado `esperando_pago`.
  - Mismo `p_request_id` dos veces ⇒ mismo `order_id`, stock descontado una sola vez.
  - Stock 1: cliente A compra 1, cliente B intenta 1 ⇒ B lanza `P0001` con mensaje que contiene `Ya no queda stock suficiente`; stock queda 0.
  - Producto inactivo ⇒ `P0001` con `ya no está disponible`.
  - `p_items` con precio inventado por el cliente (campo extra `unit_price_cents: 1`) ⇒ se ignora; se cobra el precio real.
  - `envio_ciudad` + zona `punto` ⇒ fee 0 y exige punto; zona `domicilio` ⇒ fee 1500 y exige dirección; `encomienda` sin CI ⇒ error; `recojo` ⇒ fee 0.
  - Factura pedida sin NIT ⇒ error `Escribe el NIT o CI para la factura`.
  - `submit_payment_proof` de B sobre pedido de A ⇒ error; con ruta de otra carpeta ⇒ error; correcto ⇒ `en_revision` y 1 fila en `payment_proofs`; sobre `pagado` ⇒ error.
  - `rechazado` + nueva captura ⇒ `en_revision`, 2 capturas guardadas.
  - `cancel_order_by_customer` en `en_revision` ⇒ error; en `rechazado` ⇒ `cancelado` y stock devuelto.
  - `expire_orders(now() + interval '61 minutes')` cancela el `esperando_pago` y devuelve stock; `expire_orders(now() + interval '47 hours')` no toca un `rechazado`, con `49 hours` sí; `en_revision` nunca.
  - Existe el job `vencer-pedidos` en `cron.job`.
- [ ] **Step 2: Correr** `npx supabase db reset && npm run db:test` → FAIL.
- [ ] **Step 3: Implementar** la migración.
- [ ] **Step 4: Correr** → PASS; `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): funciones de pedido con stock, idempotencia y vencimiento`.

---

### Task 3: Validación y reglas compartidas

**Files:**
- Create: `src/features/checkout/schema.ts`, `schema.test.ts`, `delivery.ts`, `delivery.test.ts`, `src/features/orders/status.ts`, `status.test.ts`

**Interfaces:**
- Produces:
  - `DEPARTMENTS: readonly string[]` (9, orden exacto).
  - `normalizePhone(raw: string): string | null` — `"+591 712 34567"` → `"71234567"`; inválido → `null`.
  - `isValidCi(raw: string): boolean` · `isValidNit(raw: string): boolean`.
  - `checkoutSchema` (zod) → `type CheckoutInput = { method: 'recojo'|'envio_ciudad'|'encomienda'; recipientName: string; phone: string; zoneId?; address?; addressReference?; meetingPointId?; meetingPointCustom?; recipientCi?; department?; city?; invoiceRequested: boolean; invoiceNit?; invoiceName? }` con mensajes en español por campo; requisitos condicionales según método y modo de zona (igual que la base).
  - `estimateDeliveryFee(method, zoneMode: 'domicilio'|'punto'|null, fees: { homeCents: number; meetingCents: number }): number` — solo para mostrar.
  - `formatOrderCode(n: number): string` → `#0231`.
  - `STATUS_LABEL: Record<OrderStatus, string>`, `customerCanCancel(status)`, `customerCanUploadProof(status)`.
- [ ] **Step 1: Pruebas que fallan:** `normalizePhone("+591 712 34567") === "71234567"`, `normalizePhone("21234567") === null`, `normalizePhone("7123456") === null`; `isValidCi("1234567-1A")`, `isValidCi("1234567 LP")`, `!isValidCi("12a")`; `isValidNit("1020304050")`, `!isValidNit("12")`; `checkoutSchema` rechaza `envio_ciudad` sin `zoneId` con mensaje `Elige una zona`, `encomienda` sin CI con `Escribe el CI de quien recoge`, factura sin NIT con `Escribe el NIT o CI para la factura`, acepta `recojo` mínimo; `estimateDeliveryFee('envio_ciudad','punto',{homeCents:1500,meetingCents:0}) === 0`, `('envio_ciudad','domicilio',…) === 1500`, `('encomienda',null,…) === 0`; `formatOrderCode(231) === "#0231"`, `formatOrderCode(12345) === "#12345"`; `customerCanCancel('rechazado') && !customerCanCancel('en_revision')`.
- [ ] **Step 2: Correr** `npm test -- checkout orders` → FAIL.
- [ ] **Step 3: Implementar** (`npm i zod`).
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(compra): validación y reglas compartidas`.

---

### Task 4: Cuentas (registro, ingreso, recuperar clave) y protección de rutas

**Files:**
- Create: `src/proxy.ts`, `src/lib/supabase/proxy-session.ts`, `src/features/auth/{actions.ts,AuthForm.tsx,UserMenu.tsx,session.ts}`, páginas `ingresar`, `registro`, `recuperar`, `nueva-clave`, `src/app/auth/confirm/route.ts`, `src/app/auth/callback/route.ts`, `e2e/auth.spec.ts`, `e2e/helpers/supabase-admin.ts`
- Modify: `src/components/layout/SiteHeader.tsx`, `MobileMenu.tsx`, `supabase/config.toml` (`enable_confirmations = false` local, explícito; `site_url`)

**Interfaces:**
- Produces:
  - `getSessionUser(): Promise<{ id: string; email: string; fullName: string | null } | null>` (session.ts, usa `createServerSupabase`, `auth.getClaims()`).
  - Server Actions: `signIn(prev, formData)`, `signUp(prev, formData)` (pide nombre completo, correo, contraseña ≥ 8, celular opcional → `profiles.phone`), `requestPasswordReset`, `updatePassword`, `signOut()`; devuelven `{ error?: string; ok?: true }` con mensajes en español ("Correo o contraseña incorrectos", "Ese correo ya tiene una cuenta. ¿Quieres ingresar?").
  - `siguiente` (ruta de retorno) solo acepta rutas internas que empiezan con `/` y no con `//`.
  - Proxy: refresca la sesión en todas las rutas salvo estáticos; si no hay sesión en `/checkout` o `/pedidos/*`, redirige a `/ingresar?siguiente=<ruta>`.
  - Cabecera: "Ingresar" sin sesión; con sesión, menú con nombre, "Mis pedidos" y "Salir".
  - `e2e/helpers/supabase-admin.ts`: `adminClient()` (service role desde `supabase status`, **solo local**), `createTestUser(email?)`, `setOrderStatus(orderId, status, extra?)`.
- [ ] **Step 1: e2e que falla** `auth.spec.ts`: registrarse con nombre/correo/contraseña ⇒ queda con sesión y la cabecera muestra el nombre; salir e ingresar de nuevo; contraseña incorrecta ⇒ "Correo o contraseña incorrectos"; `/pedidos` sin sesión ⇒ `/ingresar?siguiente=%2Fpedidos` y tras ingresar vuelve a `/pedidos`; `?siguiente=https://evil.com` ⇒ tras ingresar va a `/`; recuperar clave ⇒ llega un correo a Mailpit (`http://127.0.0.1:54324/api/v1/messages`) con enlace que abre `/nueva-clave`.
- [ ] **Step 2: Correr** `npx playwright test e2e/auth.spec.ts` → FAIL.
- [ ] **Step 3: Implementar** según la guía de `proxy` de Next 16 y el patrón de `@supabase/ssr` (getAll/setAll en request y response). Páginas con el estilo del plan 1, formularios con `autocomplete` correcto (`email`, `current-password`, `new-password`, `name`, `tel`).
- [ ] **Step 4: Correr** → PASS; suite completa del plan 1 sigue verde.
- [ ] **Step 5: Commit** `feat(cuentas): registro, ingreso, recuperar clave y rutas protegidas`.

---

### Task 5: Carrito

**Files:**
- Create: `src/features/cart/{cart-store.ts,cart-store.test.ts,useCart.ts,AddToCartButton.tsx,CartBadge.tsx,CartView.tsx}`, `e2e/carrito.spec.ts`
- Modify: `src/app/(tienda)/carrito/page.tsx` (reemplaza la provisional), `src/app/(tienda)/producto/[slug]/page.tsx` (botón real), `src/features/catalog/ProductCard.tsx` (botón "+" real), `src/components/layout/SiteHeader.tsx` (contador), `src/features/catalog/queries.ts` (+ `getProductsByIds(ids: string[]): Promise<ProductCardData & { stock: number }[]>`)

**Interfaces:**
- Produces:
  - `type CartLine = { productId: string; quantity: number }`; `cartReducer(lines, action)` con acciones `add {productId, quantity, maxStock}`, `setQuantity {productId, quantity, maxStock}`, `remove {productId}`, `clear`, `reconcile {available: Record<id, stock>}` (quita agotados/inexistentes, recorta al stock); cantidad máx. por línea `min(stock, 20)`.
  - `useCart(): { lines, count, add, setQuantity, remove, clear, reconcile }` — `localStorage` clave `ludiq:carrito:v1`, sincronizado entre pestañas (`storage` event) con `useSyncExternalStore`; si `localStorage` falla, funciona en memoria.
  - `<AddToCartButton productId stock name />` — en la ficha con selector de cantidad; muestra "Agregado ✓" 2 s; sin stock: deshabilitado "Agotado".
  - `/carrito`: líneas con foto, nombre, precio **actual** (de `getProductsByIds`), cantidad editable, quitar, subtotal; aviso "Ajustamos tu carrito: «X» ya no tiene stock" cuando `reconcile` cambia algo; botón "Continuar con la compra" → `/checkout`; vacío: "Tu carrito está vacío" + "Ver catálogo".
  - ProductCard: la tarjeta sigue enlazando a la ficha; el "+" pasa a ser un `<button aria-label="Agregar «X» al carrito">` fuera del enlace (sin anidar interactivos).
- [ ] **Step 1: Pruebas que fallan** `cart-store.test.ts`: `add` dos veces suma; no supera `maxStock` ni 20; `setQuantity(0)` quita; `reconcile({a:0,b:2})` quita `a` y recorta `b` a 2; e2e `carrito.spec.ts`: agregar Catán desde la ficha ⇒ contador 1; agregar desde el "+" de una tarjeta ⇒ contador 2; recargar ⇒ sigue; cambiar cantidad y quitar; no deja pasar del stock de Jenga (2); ingresar a la cuenta ⇒ el carrito sigue igual; producto que se desactiva (helper admin) ⇒ al abrir `/carrito` aparece el aviso y la línea desaparece.
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(carrito): carrito persistente con stock al día`.

---

### Task 6: Checkout (entrega, factura y creación del pedido)

**Files:**
- Create: `src/features/checkout/{queries.ts,CheckoutForm.tsx,actions.ts}`, `src/app/(tienda)/checkout/page.tsx`, `e2e/checkout.spec.ts`

**Interfaces:**
- Consumes: `useCart` (Tarea 5), `checkoutSchema`, `estimateDeliveryFee`, `DEPARTMENTS` (Tarea 3), `create_order` (Tarea 2), `getSessionUser` (Tarea 4).
- Produces:
  - `getCheckoutOptions(): Promise<{ zones: {id; name; mode}[]; meetingPoints: {id; name; reference}[]; fees: {homeCents; meetingCents}; store: StoreSettings }>` (cacheada con `CATALOG_TAG`).
  - `createOrderAction(input: CheckoutInput & { requestId: string; items: CartLine[] }): Promise<{ orderId: string } | { error: string; field?: keyof CheckoutInput }>` — valida con `checkoutSchema`, convierte camelCase → las claves snake_case de `p_delivery`/`p_invoice`/`p_items` de la Tarea 2, llama a la RPC con el cliente de sesión, traduce `P0001` al mensaje de la base.
  - Página `/checkout` (Suspense; sin carrito ⇒ manda a `/carrito`): tres opciones de entrega como tarjetas seleccionables (recojo muestra dirección y horario de `store_settings`; envío en ciudad pide zona y, según su modo, dirección+referencia o punto de la lista / "Otro punto (escríbelo)"; encomienda pide nombre de quien recoge, CI, departamento, ciudad y muestra el aviso de "por pagar"); celular y nombre prellenados del perfil; casilla "¿Necesitas factura?"; resumen con subtotal, envío estimado y total; botón "Continuar al pago" deshabilitado mientras envía.
  - `requestId` se genera una vez al montar (`crypto.randomUUID()`) y se reutiliza en reintentos.
  - Al crear: vacía el carrito y va a `/pedidos/<id>/pago`. Error de stock: muestra el mensaje y llama a `reconcile`.
- [ ] **Step 1: e2e que falla** `checkout.spec.ts` (usuario creado con el helper): recojo ⇒ llega a `/pedidos/<id>/pago` y la base tiene 1 pedido `esperando_pago` con fee 0; envío a Sopocachi ⇒ total incluye Bs 15; envío a El Alto ⇒ pide punto, elige "Teleférico Rojo – estación Central", fee 0; encomienda a Cochabamba sin CI ⇒ error junto al campo; factura sin NIT ⇒ error; doble clic en "Continuar al pago" ⇒ 1 solo pedido; otro usuario compra la última unidad de Jenga antes ⇒ aparece "Ya no queda stock suficiente de «Jenga»" y el carrito se ajusta; un producto desactivado entre carrito y checkout ⇒ mensaje "ya no está disponible".
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(compra): checkout con entrega, factura y creación del pedido`.

---

### Task 7: Pago con QR y subida de la captura

**Files:**
- Create: `src/features/orders/{compress.ts,compress.test.ts,ProofUploader.tsx,PaymentStep.tsx,actions.ts,queries.ts}`, `src/app/(tienda)/pedidos/[id]/pago/page.tsx`, `e2e/pago.spec.ts`, `e2e/fixtures/captura.png`

**Interfaces:**
- Consumes: `submit_payment_proof` (Tarea 2), `formatOrderCode` (Tarea 3), `getSessionUser` (Tarea 4).
- Produces:
  - `validateProofFile(file: { type: string; size: number }): string | null` — `null` si vale; `"Sube una imagen (foto o captura de pantalla)"` si no es `image/*`; `"La imagen pesa más de 10 MB"`; `"El archivo está vacío"`.
  - `compressProof(file: File): Promise<File>` — WebP, lado máx. 1600 px, calidad 0,8 (`browser-image-compression`); si falla la compresión y el original ≤ 5 MB, usa el original.
  - `getOrderForCustomer(orderId: string): Promise<OrderDetail | null>` (queries.ts; `null` si no existe o no es del usuario) con items, entrega, factura, eventos y capturas (URLs firmadas 10 min).
  - `submitProofAction(orderId: string, path: string): Promise<{ ok: true } | { error: string }>`.
  - Página de pago (solo en `esperando_pago` o `rechazado`; si no, redirige al detalle): total grande, código `#0231` con botón "Copiar código", instrucción "Escribe este código en la glosa o concepto del pago", QR de cada billetera activa (pestañas Yape/Altoke/Yasta), subida de captura con vista previa, botón "Enviar pedido" (deshabilitado sin captura) ⇒ sube a `payment-proofs/<uid>/<orderId>/<Date.now()>.webp`, llama a la acción y va a `/pedidos/<id>`. Si el pedido está `rechazado`, arriba muestra el motivo.
- [ ] **Step 1: Pruebas que fallan:** unitarias de `validateProofFile` (pdf, 11 MB, 0 bytes, png válido); e2e `pago.spec.ts`: la página muestra `#` + número y `Bs` total del pedido; "Enviar pedido" deshabilitado sin archivo; subir `captura.png` ⇒ estado "En revisión" en el detalle; subir un `.pdf` ⇒ mensaje "Sube una imagen…"; el pedido de otro usuario en `/pedidos/<id>/pago` ⇒ "no encontrado".
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar** (`npm i browser-image-compression`).
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(pago): pago con QR y subida de la captura`.

---

### Task 8: Mis pedidos (lista, detalle, reintentar y cancelar)

**Files:**
- Create: `src/app/(tienda)/pedidos/page.tsx`, `src/app/(tienda)/pedidos/[id]/page.tsx`, `src/features/orders/OrderTimeline.tsx`, `e2e/pedidos.spec.ts`
- Modify: `src/features/orders/actions.ts` (+ `cancelOrderAction(orderId)`)

**Interfaces:**
- Consumes: `getOrderForCustomer`, `STATUS_LABEL`, `customerCanCancel`, `customerCanUploadProof`, `buildWhatsAppLink`, `getStoreSettings`.
- Produces:
  - `/pedidos`: lista del usuario (más reciente primero) con código, fecha (`Intl.DateTimeFormat('es-BO')`), total, estado como insignia; vacío: "Todavía no hiciste pedidos" + "Ver catálogo".
  - `/pedidos/[id]`: estado actual con explicación en una línea por estado (p. ej. En revisión: "Estamos revisando tu pago. Te avisaremos cuando lo confirmemos."); línea de tiempo con los eventos; items; entrega; factura; capturas en miniatura; agencia y número de guía si existen; si `rechazado`: motivo + "Subir otra captura" (→ pago) + "Cancelar pedido" (confirmación); si `esperando_pago`: "Pagar ahora"; botón "Consultar por WhatsApp" con `Hola, consulto por mi pedido #0231`; pedido ajeno o inexistente ⇒ `notFound()`.
- [ ] **Step 1: e2e que falla** `pedidos.spec.ts`: la lista muestra 2 pedidos del usuario y ninguno de otro; con el helper se pasa un pedido a `rechazado` con motivo "Monto incorrecto" ⇒ el detalle muestra el motivo y permite subir otra captura ⇒ vuelve a "En revisión" y se ven 2 miniaturas; cancelar un pedido rechazado ⇒ "Cancelado" y el stock vuelve (consulta con helper); en `en_revision` no aparece "Cancelar"; el enlace de WhatsApp contiene `text=Hola%2C%20consulto%20por%20mi%20pedido%20%23` seguido del número con 4 dígitos; pedido de otro usuario ⇒ "no encontrado".
- [ ] **Step 2: Correr** → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(pedidos): mis pedidos con detalle, reintento y cancelación`.

---

### Task 9: Google, correo en la nube y publicación

**Files:**
- Modify: `src/features/auth/AuthForm.tsx` (botón "Continuar con Google"), `supabase/config.toml` (`[auth.external.google]` desactivado en local), `docs/hosting.md` (sección Auth)

**Interfaces:**
- Consumes: `/auth/callback` (Tarea 4).

- [ ] **Step 1: [Diego] Correo de la tienda (SMTP):** crear o usar la cuenta Gmail de la tienda, activar verificación en 2 pasos y generar una **contraseña de aplicación**; en Supabase → *Authentication → Emails → SMTP Settings*: `smtp.gmail.com`, puerto 465, usuario = el Gmail, contraseña = la de aplicación, remitente "Ludiq". (Resend no sirve sin dominio propio verificado; al tener dominio se puede cambiar.)
- [ ] **Step 2: [Diego] URLs de Auth:** *Authentication → URL Configuration*: Site URL `https://ludiq-lapaz.netlify.app`; Redirect URLs `https://ludiq-lapaz.netlify.app/**` y `https://deploy-preview-*--ludiq-lapaz.netlify.app/**`. Confirmación de correo **activada** en la nube.
- [ ] **Step 3: [Diego] Google (opcional; prioridad 3 del spec, puede pasar a diciembre):** en Google Cloud, crear un cliente OAuth "Aplicación web" con URI de redirección `https://lpnlqezlwsmrtywzotrf.supabase.co/auth/v1/callback`; pegar ID y secreto en Supabase → *Authentication → Providers → Google*.
- [ ] **Step 4: e2e que falla** (solo si se hace el paso 3): el botón "Continuar con Google" existe en `/ingresar` y `/registro` y su `href`/acción apunta a `…/auth/v1/authorize?provider=google`.
- [ ] **Step 5: Implementar** el botón con `signInWithOAuth({ provider: 'google', options: { redirectTo: <origen>/auth/callback?siguiente=… } })`. Correr → PASS.
- [ ] **Step 6: Subir migraciones a la nube** `npx supabase db push` (**sin** `--include-seed`: los productos de prueba ya están; zonas, puntos, billeteras y tarifas vienen en la migración). Verificar `npx supabase migration list --linked` y que `/checkout` en la vista previa lista las 10 zonas.
- [ ] **Step 7: Verificar en la vista previa del PR:** `PLAYWRIGHT_BASE_URL=<vista previa> npx playwright test e2e/smoke.spec.ts e2e/home.spec.ts e2e/carrito.spec.ts` (las de cuentas/compra que usan el helper admin son solo locales) + una compra manual completa de prueba con una cuenta real (registro → correo de confirmación → compra con recojo → captura). Borrar después ese pedido de prueba desde el panel de Supabase.
- [ ] **Step 8: Revisión final de la rama** (executing-plans) y **merge** con confirmación de Diego.

---

## Fuera de este plan (van en planes siguientes)

- Confirmar/rechazar pagos, marcar enviado con agencia/guía, ver capturas del lado del dueño, editar zonas/puntos/billeteras/tarifas → **plan 3**.
- Correos de pedido (recibido, confirmado, rechazado, enviado, vencido) y Web Push al dueño → **plan 4**. El evento `order_events` de cada cambio ya deja listo el disparador.
