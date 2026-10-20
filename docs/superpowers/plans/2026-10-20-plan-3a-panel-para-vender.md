# Plan 3A — Panel para vender

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dueño y sus hijos (cuentas admin) atienden la tienda desde `/panel`: revisan y mueven pedidos, cargan productos con fotos, registran ventas del local, corrigen stock contando el estante, configuran la tienda (QR reales, zonas, tarifas, categorías) y suman administradores; con una portada de números clave e instalable en Android.

**Architecture:** Toda acción del panel es una **función RPC de admin** en Postgres (`security definer`, valida `is_admin()`, estado y datos) llamada desde una Server Action; ninguna escritura sensible va directo desde el navegador. Cada cambio de `products.stock` queda en `stock_movements` mediante un trigger que lee el motivo de `set_config('app.stock_reason', …)`, igual que `app.actor` del plan 2. Las Server Actions que tocan catálogo o ajustes llaman `updateTag("catalogo")` para que la tienda lo muestre al instante.

**Tech Stack:** el del proyecto (Next 16 + Cache Components, Supabase, Tailwind + shadcn, zod, browser-image-compression, Vitest, Playwright, pgTAP).

**Spec:** `docs/superpowers/specs/2026-10-19-panel-dueno-design.md` (§5.1–§5.6, §6 prioridades) sobre `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md`. Contexto y lecciones: `docs/PROYECTO.md`, `CLAUDE.md`.

## Global Constraints

- Todas las reglas de `CLAUDE.md` (Node 22 con `source ~/.nvm/nvm.sh`, Next 16: `<Suspense>` para cookies/params, `updateTag` solo en Server Actions; base fuente de verdad; RLS; TDD; corregir `from "cn"` de shadcn).
- Funciones admin: verifican `public.is_admin()` y si no, `raise exception 'Solo un administrador puede hacer esto' using errcode = '42501'`; errores para la persona con `errcode 'P0001'`; `execute` revocado a `public, anon`.
- **Costos nunca en `products`** (es de lectura pública). Etapa A no guarda costos.
- **Stock = disponible.** Unidades **apartadas** = cantidades en pedidos con estado `esperando_pago`, `en_revision`, `pagado` o `listo_para_recoger` (aún físicamente en la tienda). "Contar estante": `stock = contadas − apartadas`.
- Motivos de `stock_movements.reason` (exactos): `alta`, `venta_web`, `devolucion_web`, `venta_manual`, `anulacion_venta_manual`, `ajuste` (más `compra` en etapa B).
- Canales de venta manual: `tienda`, `whatsapp`.
- "Venta" = productos (`subtotal_cents` de pedidos `pagado|enviado|listo_para_recoger|entregado`, fechados al evento a `pagado`) + ventas manuales no anuladas. Envíos cobrados aparte. Día y mes en `America/La_Paz`.
- Mensajes exactos: concurrencia `Este pedido ya cambió; recarga la página`; stock insuficiente `El stock registrado no alcanza (quedan N disponibles). Corrige el stock primero`; admin inexistente `Esa persona primero debe crear su cuenta en la tienda`.
- Panel en `/panel`; navegación inferior en celular (Inicio · Pedidos · Productos · Más), lateral en ≥ 1024 px; botones ≥ 44 px; sin efectos de entrada.
- Fotos de producto: máx. 5, WebP lado máx. 1600 px, bucket `product-images` (escritura admin, ya existe); comprobante de encomienda en bucket privado nuevo `shipping-proofs`.
- Rama `feat/plan-3-panel`, PR a `main`, una sola fusión (prioridades del spec §6 si falta tiempo).

## Review Focus

1. **Dos administradores sobre el mismo pedido a la vez** ⇒ el segundo ve "Este pedido ya cambió; recarga la página" y el stock se devuelve una sola vez → pgTAP Tarea 2 + e2e Tarea 4.
2. **Contar estante con unidades apartadas o pagadas sin retirar** ⇒ el stock nunca se infla; contar menos que lo apartado da un error claro → pgTAP Tarea 1 + e2e Tarea 5.
3. **Un comprador (no admin) llamando las funciones admin o subiendo al bucket de productos** ⇒ 42501, nada cambia → pgTAP Tareas 1 y 2.
4. **Editar precio/visibilidad de un producto o los ajustes** ⇒ la tienda muestra el cambio en la siguiente carga (no la caché vieja) → e2e Tareas 5 y 6.
5. **Foto de producto rara (PDF, 15 MB, cancelar la cámara)** ⇒ mensaje claro y el producto se puede guardar sin foto → unit + e2e Tarea 5.

---

## Estructura de archivos

```
supabase/migrations/20261020000001_stock_y_ventas_manuales.sql   # stock_movements, trigger, ventas manuales, conteo, ajuste
supabase/migrations/20261020000002_panel_admin.sql               # transiciones de pedido, admins, borrar producto, resumen, shipping-proofs
supabase/tests/panel_stock.test.sql · panel_admin.test.sql
src/features/admin/
  guard.ts            # requireAdmin()
  queries.ts          # resumen, pedidos admin, productos admin, apartadas, ajustes, admins
  order-actions.ts · product-actions.ts · settings-actions.ts   # Server Actions → RPC + updateTag
  transitions.ts (+ .test.ts)   # qué botones mostrar por estado y método
  PanelShell.tsx · PanelNav.tsx · SummaryCards.tsx
  orders/ (OrderList, OrderDetail, OrderActions, RejectDialog, ShipDialog)
  products/ (ProductTable, ProductForm, PhotoManager, StockControls, CountShelfDialog, ManualSaleDialog)
  settings/ (StoreForm, FeesForm, ZonesEditor, PointsEditor, WalletsEditor, CategoriesEditor, AdminsEditor, SampleProductsButton)
src/app/panel/ layout.tsx · page.tsx · pedidos/page.tsx · pedidos/[id]/page.tsx · productos/page.tsx · productos/nuevo/page.tsx · productos/[id]/page.tsx · ajustes/page.tsx · mas/page.tsx
public/panel.webmanifest · public/icons/panel-192.png · panel-512.png
e2e/panel-*.spec.ts · e2e/helpers/admin.ts
```

---

### Task 1: Historial de stock, ventas manuales y conteo de estante (base)

**Files:**
- Create: `supabase/migrations/20261020000001_stock_y_ventas_manuales.sql`, `supabase/tests/panel_stock.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerar)

**Interfaces:**
- Produces:
  - `stock_movements(id bigint identity pk, product_id uuid → products on delete cascade, delta int not null, reason text not null check (reason in ('alta','venta_web','devolucion_web','venta_manual','anulacion_venta_manual','ajuste','compra')), ref_id uuid, actor uuid, note text, created_at timestamptz default now())`; RLS: solo admin lee; nadie escribe salvo el trigger.
  - Trigger `products_log_stock` (after insert, after update of stock): inserta `delta = new.stock - coalesce(old.stock, 0)` si ≠ 0; `reason = coalesce(nullif(current_setting('app.stock_reason', true), ''), case when TG_OP = 'INSERT' then 'alta' else 'ajuste' end)`; `ref_id`, `note` de `app.stock_ref`/`app.stock_note`; `actor = auth.uid()`.
  - Recrear `create_order` (copiar de `20261019000005`) poniendo `app.stock_reason='venta_web'`, `app.stock_ref=<order_id>` antes de descontar; `restock_order` pone `devolucion_web` + ref del pedido.
  - `manual_sales(id uuid pk, product_id uuid → products, quantity int check 1..100, unit_price_cents int ≥ 0, channel text check in ('tienda','whatsapp'), note text, created_by uuid not null, created_at, voided_at timestamptz, voided_by uuid)`; RLS: admin lee; escritura solo vía RPC.
  - `admin_reserved_units() returns table (product_id uuid, quantity int)` — suma en estados apartados.
  - `admin_record_manual_sale(p_product_id uuid, p_quantity int, p_channel text, p_unit_price_cents int, p_note text default null) returns uuid` — bloquea el producto; si `stock < p_quantity`: si hay unidades apartadas del producto ⇒ `P0001` `«<nombre>»: las unidades que faltan están apartadas por el pedido #<0000> (vence a las <HH:MM>)` (la hora solo si está `esperando_pago`), si no ⇒ el mensaje exacto de stock insuficiente; descuenta con `venta_manual`.
  - `admin_void_manual_sale(p_sale_id uuid) returns void` — ya anulada ⇒ `P0001` `Esta venta ya estaba anulada`; devuelve stock con `anulacion_venta_manual`.
  - `admin_count_shelf(p_product_id uuid, p_counted int) returns int` — `p_counted < apartadas` ⇒ `P0001` `Contaste menos de lo apartado en pedidos (<N>). Revisa los pedidos pendientes`; fija `stock = p_counted - apartadas` con `ajuste` y nota `Conteo de estante: <p_counted>`; devuelve el nuevo stock.
  - `admin_adjust_stock(p_product_id uuid, p_delta int) returns int` — no baja de 0 (`P0001` `El stock no puede quedar negativo`); motivo `ajuste`.

- [ ] **Step 1: pgTAP que falla** `panel_stock.test.sql` (admin y cliente creados en la prueba; producto propio stock 5):
  - crear producto con stock 5 ⇒ 1 movimiento `alta` +5;
  - `create_order` de 2 ⇒ movimiento `venta_web` −2 con `ref_id` = pedido; `cancel_order_by_customer` (estado `rechazado`) ⇒ `devolucion_web` +2;
  - venta manual de 2 ⇒ stock 3, movimiento `venta_manual` −2; anularla ⇒ stock 5; anularla otra vez ⇒ error `ya estaba anulada`;
  - venta manual de 9 ⇒ `P0001` `El stock registrado no alcanza (quedan 5 disponibles)…`;
  - con 1 unidad apartada en un pedido `esperando_pago` y stock 0, venta manual de 1 ⇒ mensaje que contiene `apartadas por el pedido #`;
  - stock 3 con 2 apartadas (`en_revision` 1 + `pagado` 1): `admin_count_shelf(p, 5)` ⇒ stock 3 y movimiento con nota `Conteo de estante: 5`; `admin_count_shelf(p, 1)` ⇒ error `Contaste menos de lo apartado`;
  - `admin_adjust_stock(p, -99)` ⇒ error negativo; `(p, +2)` ⇒ ok;
  - como cliente: cada función ⇒ 42501; `select` de `stock_movements` y `manual_sales` ⇒ 0 filas;
  - suma de `delta` de un producto = su stock final (cuadra).
- [ ] **Step 2: Correr** `npx supabase db reset && npm run db:test` → FAIL.
- [ ] **Step 3: Implementar** la migración.
- [ ] **Step 4: Correr** → PASS (incluye las pruebas de los planes 1 y 2); `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): historial de stock, ventas manuales y conteo de estante`.

---

### Task 2: Transiciones de pedido, administradores, borrar producto y resumen (base)

**Files:**
- Create: `supabase/migrations/20261020000002_panel_admin.sql`, `supabase/tests/panel_admin.test.sql`

**Interfaces:**
- Produces:
  - `orders.shipping_proof_path text`; bucket privado `shipping-proofs` (5 MB, jpeg/png/webp/heic); admin sube/lee; el dueño del pedido lee lo de sus pedidos.
  - `admin_set_order_status(p_order_id uuid, p_expected_from order_status, p_to order_status, p_rejection_reason text default null, p_shipping_agency text default null, p_tracking_code text default null, p_shipping_proof_path text default null) returns void`. Transiciones permitidas (cualquier otra ⇒ `P0001` `No se puede pasar de «<from>» a «<to>»`):

    | desde | hacia | condición |
    |---|---|---|
    | `en_revision` | `pagado` | — |
    | `en_revision` | `rechazado` | `p_rejection_reason` no vacío (si no: `Escribe el motivo del rechazo`) |
    | `pagado` | `listo_para_recoger` | solo `recojo` |
    | `pagado` | `enviado` | `envio_ciudad` o `encomienda`; encomienda exige agencia y guía (`Escribe la agencia y el número de guía`) |
    | `enviado`, `listo_para_recoger` | `entregado` | — |
    | `pagado`, `enviado`, `listo_para_recoger` | `reembolsado` | devuelve stock |
    | `esperando_pago`, `rechazado` | `cancelado` | devuelve stock |

    Si el estado actual ≠ `p_expected_from` ⇒ `P0001` `Este pedido ya cambió; recarga la página` (bloqueando la fila con `for update`). Pone `app.actor='admin'` y `app.note` (motivo o agencia/guía).
  - `admin_set_admin(p_email text, p_make_admin boolean) returns void` — busca `auth.users` por correo sin distinguir mayúsculas; reglas del spec §5.6 (`No puedes quitarte a ti mismo`, `Debe quedar al menos un administrador`, mensaje exacto si no existe).
  - `admin_list_admins() returns table (id uuid, email text, full_name text)`.
  - `admin_delete_product(p_product_id uuid) returns text` — `'oculto'` si aparece en `order_items` o `manual_sales` (pone `is_active=false`), si no `'borrado'`.
  - `admin_dashboard_summary() returns jsonb` con claves `pendingReview`, `pendingReviewOver24h`, `toDeliver`, `salesToday {cents, count}`, `salesMonth {cents, count}`, `shippingMonthCents`, `lowStock` (array `{id, name, stock}` de activos con stock 1–3), `outOfStock` (int). Reglas de "venta" de Global Constraints; zona `America/La_Paz`.

- [ ] **Step 1: pgTAP que falla** `panel_admin.test.sql`:
  - cada transición de la tabla ok y una inválida (`pagado`→`rechazado`) con el mensaje;
  - `p_expected_from` desactualizado ⇒ `Este pedido ya cambió`; reembolsar dos veces seguidas (la segunda con `expected_from='pagado'`) ⇒ la segunda falla y el stock subió una sola vez;
  - rechazo sin motivo ⇒ error; encomienda sin guía ⇒ error; recojo → `enviado` ⇒ error;
  - el evento registrado tiene `actor='admin'` y la nota;
  - `admin_set_admin('B@TEST.BO', true)` (mayúsculas) ⇒ B es admin; quitarse a sí mismo ⇒ error; quitar al último ⇒ error; correo inexistente ⇒ mensaje exacto;
  - `admin_delete_product` de producto vendido ⇒ `'oculto'`; de uno nuevo ⇒ `'borrado'`;
  - `admin_dashboard_summary()` con: 1 pedido pagado hoy (subtotal 1000 + envío 1500), 1 venta manual 500, 1 en revisión hace 25 h, 1 reembolsado ⇒ `salesToday = {cents: 1500, count: 2}`, `shippingMonthCents = 1500`, `pendingReview = 1`, `pendingReviewOver24h = 1`;
  - como cliente: todas ⇒ 42501.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS; `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): funciones admin de pedidos, administradores y resumen`.

---

### Task 3: Acceso al panel y estructura

**Files:**
- Create: `src/features/admin/guard.ts`, `src/features/admin/PanelShell.tsx`, `PanelNav.tsx`, `src/app/panel/layout.tsx`, `src/app/panel/page.tsx` (provisional: título "Panel"), `src/app/panel/mas/page.tsx`, `e2e/helpers/admin.ts`, `e2e/panel-acceso.spec.ts`
- Modify: `src/features/auth/redirect.ts` (`isProtectedPath` incluye `/panel`), `src/features/auth/session.ts` (+ `isAdmin: boolean`), `UserMenu.tsx` + `HeaderAccount.tsx` (ítem "Panel" si admin)

**Interfaces:**
- Produces: `requireAdmin(): Promise<SessionUser>` (llama `notFound()` si no hay sesión admin); `SessionUser.isAdmin`; helper e2e `loginAsAdmin(page): Promise<TestUser>` (crea usuario, `makeAdmin`, ingresa); `PanelShell` con navegación inferior (celular) / lateral (≥ 1024 px) y enlaces `Inicio /panel`, `Pedidos /panel/pedidos`, `Productos /panel/productos`, `Más /panel/mas` (Ajustes, Administradores, "Ver la tienda").
- El panel no usa el layout de `(tienda)`; tiene el suyo (sin pie, encabezado compacto con el nombre de la tienda).

- [ ] **Step 1: e2e que falla** `panel-acceso.spec.ts`: sin sesión `/panel` ⇒ `/ingresar?siguiente=%2Fpanel`; cliente común ⇒ "No encontramos esta página" y sin "Panel" en su menú; admin ⇒ ítem "Panel" en el menú lleva a `/panel`, ve la navegación con 4 enlaces (celular: barra inferior visible; PC: lateral).
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): acceso solo para administradores y navegación`.

---

### Task 4: Pedidos en el panel

**Files:**
- Create: `src/features/admin/transitions.ts` (+ `transitions.test.ts`), `src/features/admin/order-actions.ts`, `src/features/admin/orders/*`, `src/app/panel/pedidos/page.tsx`, `src/app/panel/pedidos/[id]/page.tsx`, `e2e/panel-pedidos.spec.ts`
- Modify: `src/features/admin/queries.ts` (+ pedidos), `src/features/orders/queries.ts` (detalle del comprador muestra el comprobante de envío si existe)

**Interfaces:**
- Consumes: `admin_set_order_status` (Tarea 2), `requireAdmin` (Tarea 3), `STATUS_LABEL`, `formatOrderCode`, `buildWhatsAppLink`, `compressProof`.
- Produces:
  - `availableActions(status: OrderStatus, method: DeliveryMethod): Action[]` con `Action = 'confirmar' | 'rechazar' | 'listo' | 'enviar' | 'entregar' | 'reembolsar' | 'cancelar'` (según la tabla de la Tarea 2).
  - `listAdminOrders(tab: 'revisar' | 'entregar' | 'historial', opts?: { q?: string; status?: OrderStatus }): Promise<AdminOrderRow[]>`; `getAdminOrder(id): Promise<AdminOrderDetail | null>` (capturas y comprobante con URL firmada, cliente con correo y celular, `over24h`).
  - Server Action `setOrderStatusAction(input: { orderId; expectedFrom; to; rejectionReason?; shippingAgency?; trackingCode?; shippingProofPath? }): Promise<{ ok: true } | { error: string }>`.
  - Pantallas: pestañas (`?tab=`), detalle con capturas a pantalla completa (tocar para ampliar), monto y código grandes, botones según `availableActions`, diálogo de rechazo con atajos "Monto incorrecto", "No se ve el pago", "No encontramos el pago" + texto libre, diálogo de envío (encomienda: agencia, guía, foto opcional), confirmación para reembolsar/cancelar, "Escribir al cliente por WhatsApp" (`Hola <nombre>, te escribimos de <tienda> por tu pedido #0231`).
- [ ] **Step 1: Pruebas que fallan:** unit `availableActions('en_revision','recojo')` = `['confirmar','rechazar']`; `('pagado','recojo')` = `['listo','reembolsar']`; `('pagado','encomienda')` = `['enviar','reembolsar']`; `('esperando_pago',…)` = `['cancelar']`; `('entregado',…)` = `[]`. e2e `panel-pedidos.spec.ts` (pedidos creados con `createOrderFor` + `uploadProof`/`setOrderStatus`): "Por revisar" lista el pedido y destaca uno de >24 h ("Hace más de 24 h"); confirmar ⇒ pasa a "Por entregar"; rechazar con atajo "Monto incorrecto" ⇒ el comprador ve "Motivo: Monto incorrecto" en su detalle; encomienda: "Marcar como enviado" sin guía muestra error, con agencia+guía ⇒ el comprador ve "Enviado por <agencia> · Guía <guía>"; reembolsar un pagado ⇒ estado "Reembolsado" y stock +1; dos pestañas del admin: confirmar en una y luego rechazar en la otra ⇒ "Este pedido ya cambió; recarga la página"; el enlace de WhatsApp contiene el código.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): revisar, confirmar, rechazar y despachar pedidos`.

---

### Task 5: Productos, fotos, stock y ventas manuales

**Files:**
- Create: `src/features/admin/product-actions.ts`, `src/features/admin/products/*`, `src/features/admin/slug.ts` (+ `slug.test.ts`), `src/app/panel/productos/page.tsx`, `productos/nuevo/page.tsx`, `productos/[id]/page.tsx`, `e2e/panel-productos.spec.ts`
- Modify: `next.config.ts` (`images.remotePatterns` para `<ref>.supabase.co/storage/v1/object/public/**` y `127.0.0.1:54321` local), `src/features/admin/queries.ts` (+ productos admin con apartadas y movimientos)

**Interfaces:**
- Consumes: funciones de la Tarea 1 y `admin_delete_product`; `compressProof` (reutilizar como `compressImage` genérico: mover a `src/lib/images-compress.ts` con `maxSide` 1600) ; `validateProofFile`.
- Produces:
  - `slugify(name: string): string` — sin tildes, minúsculas, guiones (`"Catán: Ciudades y Caballeros" → "catan-ciudades-y-caballeros"`); colisión ⇒ sufijo `-2`, `-3` (resuelto en la acción consultando la base).
  - `productInputSchema` (zod): nombre 3–120, categoría uuid, precio Bs > 0, precio anterior opcional > precio, edad 0–99, jugadores mín ≥ 1 y máx ≥ mín, stock inicial ≥ 0 (solo al crear), descripción ≤ 2000, `isNew`, `isActive`.
  - Server Actions (todas con `requireAdmin` y `updateTag("catalogo")`): `saveProductAction`, `deleteProductAction` (devuelve `'borrado' | 'oculto'`), `addProductPhotoAction(productId, path)`, `removeProductPhotoAction`, `makeMainPhotoAction`, `adjustStockAction(productId, delta)`, `countShelfAction(productId, counted)`, `recordManualSaleAction({ productId, quantity, channel, unitPriceCents, note })`, `voidManualSaleAction(saleId)`.
  - Pantallas: lista con buscador y filtros (categoría, activos, ocultos, agotados), por fila: foto, nombre, precio, **stock disponible + "N apartadas"**, botones − / +, "Vendí"; formulario (crear/editar; el stock solo al crear; en edición: botones "Contar estante" y ± ), gestor de fotos (máx. 5, "Tomar foto" `capture="environment"` y "Elegir de la galería", quitar, "Hacer principal"), diálogo "Vendí" (cantidad, canal Tienda/WhatsApp, precio unitario precargado, nota), historial de movimientos en el detalle (motivo legible, fecha, cambio) con "Anular" en ventas manuales.
- [ ] **Step 1: Pruebas que fallan:** unit `slugify` (tildes, signos, espacios dobles, ñ→n); unit `productInputSchema` (precio anterior ≤ precio ⇒ `El precio anterior debe ser mayor que el precio`; máx < mín jugadores). e2e `panel-productos.spec.ts`: crear "Juego de prueba e2e" con una foto (`captura.png`) ⇒ aparece en `/catalogo` en la siguiente carga y su ficha muestra la foto; cambiar el precio ⇒ la ficha pública muestra el nuevo precio; ocultar ⇒ desaparece del catálogo; borrar uno vendido ⇒ "Se ocultó porque tiene ventas"; un PDF como foto ⇒ "Sube una imagen…" y el producto se guarda igual sin foto; "Vendí" 1 por Tienda ⇒ stock −1 y movimiento "Venta en tienda"; vender más que el stock ⇒ el mensaje exacto; "Contar estante" con un pedido pagado sin retirar de ese producto ⇒ el stock queda en contadas − 1; anular la venta ⇒ stock vuelve.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): productos con fotos, stock y ventas del local`.

---

### Task 6: Ajustes y administradores

**Files:**
- Create: `src/features/admin/settings-actions.ts`, `src/features/admin/settings/*`, `src/app/panel/ajustes/page.tsx`, `e2e/panel-ajustes.spec.ts`

**Interfaces:**
- Consumes: `admin_set_admin`, `admin_list_admins`, `delete_sample_products` (Tareas 2 y plan 1); RLS admin de `store_settings`, `delivery_zones`, `meeting_points`, `payment_methods`, `categories`.
- Produces: Server Actions (con `requireAdmin` + `updateTag("catalogo")`): `saveStoreAction`, `saveFeesAction`, `saveZoneAction`/`deleteZoneAction` (borrar solo si ningún pedido la usa; si no, desactivar), `savePointAction`/`deletePointAction` (ídem), `saveWalletAction` (sube el QR a `store-assets/qr/<uuid>.<ext>`), `deleteWalletAction`, `saveCategoryAction`/`deleteCategoryAction` (`P0001`-style: `Esta categoría tiene productos; muévelos primero`), `setAdminAction(email, makeAdmin)`, `deleteSampleProductsAction` (con confirmación escrita "BORRAR"). Secciones en una sola página con anclas: Tienda · Envíos · Zonas · Puntos de encuentro · Billeteras QR · Categorías · Administradores · Productos de prueba.
- [ ] **Step 1: e2e que falla** `panel-ajustes.spec.ts`: cambiar el WhatsApp ⇒ el pie de la tienda usa el nuevo número; subir un QR nuevo para Yape ⇒ la página de pago de un pedido muestra la imagen nueva; tarifa a domicilio 20 ⇒ el checkout suma Bs 20; crear zona "Obrajes" (domicilio) ⇒ aparece en el checkout; desactivar un punto ⇒ ya no aparece; agregar admin por correo existente ⇒ esa cuenta ve "Panel"; correo inexistente ⇒ mensaje exacto; quitarse a sí mismo ⇒ error. (Restaurar los valores del seed al final de cada prueba.)
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): ajustes de la tienda y administradores`.

---

### Task 7: Portada con números y app instalable

**Files:**
- Create: `src/features/admin/SummaryCards.tsx`, `public/panel.webmanifest`, `public/icons/panel-192.png`, `public/icons/panel-512.png` (generados con un script desde el cubo del logo), `e2e/panel-portada.spec.ts`
- Modify: `src/app/panel/page.tsx`, `src/app/panel/layout.tsx` (metadata `manifest: "/panel.webmanifest"`, `appleWebApp`), `src/features/admin/queries.ts` (+ `getDashboardSummary()`)

**Interfaces:**
- Consumes: `admin_dashboard_summary` (Tarea 2).
- Produces: portada con tarjetas: "Por revisar" (N; aviso "N llevan más de 24 h"), "Por entregar", "Ventas de hoy" (Bs y cantidad), "Ventas del mes", "Envíos cobrados del mes", "Poco stock" (lista corta, enlace a productos filtrados), "Agotados"; atajos "Nuevo producto" y "Vendí en tienda". Manifest: `name` "<tienda> · Panel", `short_name` "Panel", `start_url` "/panel", `scope` "/panel", `display` "standalone", `background_color`/`theme_color` `#f6efe3`, íconos 192/512 (`purpose: any maskable`).
- [ ] **Step 1: e2e que falla** `panel-portada.spec.ts`: con 1 pedido en revisión, 1 pagado hoy (Catán) y 1 venta manual de UNO, la portada muestra "Por revisar 1" y "Ventas de hoy" con `Bs 485` y `2`; tocar "Poco stock" lleva a la lista filtrada; `/panel.webmanifest` responde con `start_url` `/panel` y los dos íconos existen (200).
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS; Lighthouse PWA "installable" en la vista previa. **Step 5: Commit** `feat(panel): portada con números clave e instalable`.

---

### Task 8: Publicación

- [ ] **Step 1: Docs:** `docs/hosting.md` (cómo marcar el primer admin: `update public.profiles set role='admin' where id = (select id from auth.users where lower(email) = lower('<correo>'));` en el SQL Editor) y `docs/PROYECTO.md` (estado, nuevas tablas y funciones).
- [ ] **Step 2: [Diego]** `npx supabase db push` (2 migraciones) y marcar como admin la cuenta del dueño (o la de Diego para probar).
- [ ] **Step 3: Vista previa del PR:** e2e públicas contra la vista previa; prueba manual en el celular Android del dueño: instalar el panel, confirmar un pedido de prueba, cargar un producto con foto de la cámara.
- [ ] **Step 4: Revisión final** (executing-plans) con su Review Focus; correcciones con TDD.
- [ ] **Step 5: Merge** con visto bueno de Diego; verificar producción; `npx repomix` y memoria.
