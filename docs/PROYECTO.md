# Ludiq — tienda online de juegos de mesa (La Paz, Bolivia)

> Memoria del proyecto: qué se construye, por qué, cómo está armado y en qué estado está.
> Actualizado: 19/10/2026 (planes 1 y 2 en producción; empieza el plan 3).
> "Ludiq" es un nombre de relleno: el nombre, el logo y el lema reales los pone el cliente.

---

## 1. La idea

**Cliente:** una tienda física de juegos de mesa y juguetes de razonamiento en La Paz: ajedrez, cubos Rubik, Catán, Monopolio, Scrabble, UNO, casino y mini canchitas. Tiene unos 40 a 50 productos. Vende en el local y por WhatsApp. Confirma los pagos de Yape a mano, mirando la captura que le mandan.

**Qué debe lograr la web:**
- Que cualquiera vea el catálogo **sin cuenta**, y que para **comprar** haya que ingresar.
- Pago con **QR** (Yape, Altoke, Yasta): el comprador sube la **captura** y el dueño la **confirma a mano**.
- Tres formas de entrega:
  - **recojo** en la tienda;
  - **envío dentro de La Paz**: a domicilio o en un **punto de encuentro** (plazas, teleférico) para zonas alejadas;
  - **encomienda por bus** a otro departamento, a nombre de quien recoge (con CI), con el pasaje "por pagar".
- Factura opcional, con NIT o CI y razón social.
- **Panel del dueño** en su celular Android o en la PC de la tienda: tiene que ser muy simple, porque le cuesta la tecnología. Ahí van el CRUD de productos, la revisión de pagos, las estadísticas y el botón "Vendí en tienda".
- Diseño llamativo, que funcione bien en celular y en PC.
- **Casi gratis** para el piloto. Después habrá mensualidades.
- Sirve de **portafolio** para Diego, el desarrollador, con una versión **demo** del panel para otros negocios (etapa 2).
- **Plazo:** vender antes de Navidad 2026.

Documentos de origen:
- [spec (diseño aprobado)](superpowers/specs/2026-10-18-tienda-juegos-design.md)
- [hoja de ruta](superpowers/plans/README.md)
- [bocetos](superpowers/mockups/)

## 2. Decisiones principales

| Tema | Decisión | Por qué |
|---|---|---|
| Stack | **Next.js 16 + Supabase** (elegido por Diego para aprender, viniendo de Vue/Laravel/Flask) | Aprender React; Supabase trae Postgres, cuentas, archivos y RLS |
| UI | Tailwind 4 + shadcn/ui (Radix) + lucide; CSS modules para efectos | Rápido, accesible y consistente |
| Estilo | **"Ludoteca cálida"**: crema, madera y verde tablero, con Fraunces e Inter | Se eligió entre 3 bocetos. Agrega el **cubo 3D**, el **Illimani** y el **teleférico** |
| Hosting | **Netlify gratis** (permite uso comercial) | Vercel Hobby no permite vender. 300 créditos al mes, cada despliegue a producción gasta 15 y las vistas previas son gratis |
| Base | Supabase gratis, en us-east-1 | El plan 4 agrega una consulta diaria para que no se pause y respaldos con pg_dump |
| Pagos | Confirmación manual de la captura | El cliente ya trabaja así; sin costo de pasarela |
| Stock | Se **reserva** al crear el pedido, en el estado `esperando_pago`, y vence a los 60 minutos | El código del pedido tiene que existir antes de pagar, porque va en la glosa |
| Correos | SMTP con Gmail (piloto: universitywebsite2026@gmail.com; luego uno propio de la tienda) | Resend necesita un dominio verificado; Supabase trae un límite de correos muy bajo |
| Repositorio | GitHub `Vega-Mtz-JD/web_jugueteria_venta` (público) | `main` es producción; se trabaja en ramas `feat/…` con PR y vista previa de Netlify |

## 3. Arquitectura

```
Navegador ──► Netlify (Next.js 16 vía adaptador OpenNext)
               ├─ src/proxy.ts ─ refresca la sesión (cookies) y protege /checkout y /pedidos
               ├─ Server Components ─ catálogo con "use cache" + cacheTag("catalogo")
               ├─ Server Actions ─ cuentas, carrito al día, crear pedido, enviar captura, cancelar
               └─ Client Components ─ carrito (localStorage), formularios, subida de captura
                         │
                         ▼
               Supabase (Postgres + Auth + Storage + pg_cron)
               ├─ RLS en todas las tablas; el cliente solo LEE lo suyo
               ├─ Funciones RPC security definer: create_order, submit_payment_proof,
               │  cancel_order_by_customer, expire_orders (pg_cron cada 10 min),
               │  delete_sample_products, restock_order (interna)
               ├─ Trigger que registra cada cambio de estado en order_events (actor y nota)
               └─ Buckets: product-images (público), store-assets (público, QR), payment-proofs (privado)
```

**Reglas de diseño:**
1. **La base es la fuente de verdad.** Precios, tarifas, stock y estados se calculan y validan en Postgres. El navegador nunca escribe en `orders`.
2. **Errores para el comprador** con `errcode 'P0001'`: la web muestra ese mensaje tal cual, por ejemplo "Ya no queda stock suficiente de «Jenga»".
3. **Idempotencia:** cada pedido lleva un `request_id`, guardado en `sessionStorage` según el contenido del carrito. El doble clic, el reintento o la recarga devuelven el mismo pedido.
4. **Next 16 con Cache Components:**
   - lo público va con `"use cache"` en `src/features/catalog/cached.ts`, y `queries.ts` queda sin caché para poder probarlo;
   - todo lo que lee `cookies()`, `params` o `searchParams` va dentro de `<Suspense>`;
   - el cliente con sesión llama a `await connection()`.

### Modelo de datos (resumen)

- `profiles` (id = auth.users; `role`: customer o admin; nombre, celular). El rol **no** se puede editar desde la API.
- `categories`, `products` (precios en **centavos**; `search_text` generado sin tildes; `is_sample`; `is_active`), `product_images`.
- `store_settings`: una sola fila con nombre, lema, WhatsApp, dirección, horario y tarifas de envío.
- `delivery_zones` (`domicilio` o `punto`), `meeting_points`, `payment_methods` (QR).
- `orders`:
  - estado: `esperando_pago → en_revision → pagado → enviado / listo_para_recoger → entregado`, y además `rechazado`, `cancelado` y `reembolsado`;
  - datos de entrega, factura, totales, número `#0231`, motivo de rechazo y guía de la encomienda.
- `order_items` (con una copia del nombre y del precio), `order_events` (historial), `payment_proofs` (todas las capturas); `orders.shipping_proof_path` (foto del comprobante de la encomienda, bucket privado `shipping-proofs`).
- `stock_movements` (plan 3A): **cada** cambio de `products.stock` queda registrado por el trigger `products_log_stock` con su motivo (`alta`, `venta_web`, `devolucion_web`, `venta_manual`, `anulacion_venta_manual`, `ajuste`, `compra`), que indica quien cambia el stock con `set_config('app.stock_reason' / 'app.stock_ref' / 'app.stock_note')` (función `set_stock_reason`). La suma de los movimientos de un producto es su stock.
- `notification_outbox` y `push_subscriptions` (plan 4): un trigger sobre `order_events` encola cada aviso (`pedido_recibido`, `pago_por_revisar`, `nueva_captura`, `pago_confirmado`, `pago_rechazado`, `enviado`, `listo_para_recoger`, `cancelado`, `reembolsado`, `prueba`); `wake_notifier()` despierta por `pg_net` a la Edge Function `supabase/functions/notify` (URL y secreto en Vault), que usa `claim_notifications` / `finish_notification` (solo `service_role`). Los textos están en `supabase/functions/_shared/messages.ts`.
- `manual_sales` (plan 3A): ventas en la tienda o por WhatsApp (`tienda` / `whatsapp`), con anulación.
- **Stock = disponible.** Unidades **apartadas** = las de pedidos `esperando_pago`, `en_revision`, `rechazado`, `pagado` o `listo_para_recoger` (ya descontadas, pero todavía en la tienda). "Contar estante" guarda `contadas − apartadas`.
- **Funciones del panel** (todas `security definer`, validan `require_admin()` ⇒ `42501`): `admin_set_order_status` (tabla de transiciones y control de concurrencia con el estado esperado), `admin_record_manual_sale`, `admin_void_manual_sale`, `admin_count_shelf`, `admin_adjust_stock`, `admin_reserved_units`, `admin_delete_product` (oculta si tuvo ventas), `admin_set_admin` / `admin_list_admins`, `admin_customer_contact`, `admin_dashboard_summary` (venta = productos de pedidos con pago confirmado + ventas manuales; envíos aparte; días en `America/La_Paz`).

## 4. Estructura del repositorio

```
src/
  app/
    (tienda)/            inicio, catalogo, producto/[slug], carrito, checkout, ingresar, registro,
                         recuperar, nueva-clave, pedidos, pedidos/[id], pedidos/[id]/pago, error.tsx
    auth/confirm         enlaces de correo (token_hash) · auth/callback (Google, futuro)
    panel/               portada, pedidos, pedidos/[id], productos, productos/nuevo, productos/[id], ajustes, mas
    layout.tsx, globals.css (tokens), sitemap.ts, robots.ts, not-found.tsx, global-error.tsx
  components/ui          shadcn (button, badge, sheet, dropdown-menu, …)
  components/brand       Logo, Cube3D, IllimaniLandscape, FloatingPieces, Reveal, MotionToggle
  components/layout      SiteHeader, SiteFooter, MobileMenu, NotFoundMessage
  features/catalog       consultas (queries/cached), filtros de la URL, tarjetas, grilla y galería
  features/auth          Server Actions, formularios, sesión, redirección segura y menú de usuario
  features/cart          almacén localStorage, useCart, useCartProducts y botones
  features/checkout      esquema zod (celular, CI, NIT), tarifas, formulario y acción create_order
  features/orders        estados, consultas, acciones, pago QR, subida de captura y línea de tiempo
  features/admin         panel: guardia, consultas, Server Actions (pedidos, productos, ajustes), transiciones,
                         slug, esquema del producto, PanelShell/PanelNav, SummaryCards, orders/, products/, settings/
  lib/                   dinero (formatBs), etiquetas, búsqueda, WhatsApp, imágenes, clientes de Supabase
  proxy.ts               sesión y rutas protegidas
supabase/
  migrations/            esquema del catálogo, pedidos, funciones RPC y correcciones
  tests/                 pgTAP (RLS, funciones, seed)
  templates/             correos en español (confirmar cuenta, recuperar contraseña)
  seed.sql               6 categorías, ajustes y 18 productos de prueba
e2e/                     Playwright (PC y celular) + helpers (admin local, sesión, captura). Proyectos:
                         desktop/mobile (tienda) → desktop-panel/mobile-panel (panel-*.spec) → portada
public/panel.webmanifest panel instalable (íconos en public/icons, generados con scripts/panel-icons.mjs)
docs/                    spec, planes, bocetos, hosting.md y este archivo
.claude/skills/          skills de Claude Code usadas en el proyecto
```

## 5. Calidad y forma de trabajo

- **TDD:** cada cambio empieza con una prueba que falla.
- **Pruebas:**
  - unitarias con Vitest (`npm test`);
  - integración contra Supabase local (`npm run test:int`);
  - base de datos con pgTAP (`npm run db:test`);
  - e2e con Playwright en PC (1280 px) y celular (360 px) (`npm run test:e2e`).

  Al cierre del plan 2 había **57 unitarias, 17 de integración, 92 aserciones pgTAP y 119 e2e**.
- **CI en GitHub Actions:** un job hace lint, tipos y unitarias; otro levanta Supabase y corre pgTAP, integración, build y e2e.
- **Antes de fusionar:** vista previa del PR en Netlify, pruebas públicas contra la vista previa, Lighthouse en celular (meta: rendimiento ≥ 85 y accesibilidad ≥ 95) y la auditoría `web-design-guidelines`.
- **Revisión final de cada rama:** la hace un agente independiente. Se corrigen los hallazgos críticos e importantes con TDD; los menores quedan anotados.
- **Local:**
  - `npx supabase start` levanta la base (Docker) y `npm run dev` la web;
  - `npm run db:reset` reinicia la base y borra `.next`;
  - las e2e reponen el seed y compilan desde cero ellas solas (`e2e/reset-db.mts`).

## 6. Skills de Claude Code usadas

Están en `.claude/skills/`; los créditos y licencias, en `.claude/skills/LICENSES/`.

| Etapa | Skills |
|---|---|
| Idea y diseño | `brainstorming` (con bocetos en el navegador), `frontend-design`, `ui-ux-pro-max`, `design-system`, `theme-factory` |
| Planificar | `writing-plans` (planes con tareas, interfaces y pruebas) |
| Construir | `executing-plans` (con registro de decisiones), `test-driven-development`, `systematic-debugging`, `ui-styling`, `react-best-practices`, `composition-patterns` |
| Verificar | `verification-before-completion`, `webapp-testing`, `web-design-guidelines`, `requesting-code-review` |
| Cerrar | `finishing-a-development-branch`, `find-skills` |

## 7. Estado

| Plan | Contenido | Estado |
|---|---|---|
| 1 | Fundaciones y catálogo público (portada, catálogo, ficha, SEO, CI, Netlify) | ✅ En producción: https://ludiq-lapaz.netlify.app (PR #1) |
| 2 | Cuentas, carrito, checkout, pago QR y mis pedidos | ✅ En producción (PR #2). Compra real probada por Diego en la vista previa; SMTP con Gmail funcionando |
| 3A | Panel para vender: portada con números clave, pedidos (revisar, confirmar, rechazar, enviar, reembolsar), productos con fotos, stock con historial, "Vendí", contar estante, ajustes y administradores; instalable | ✅ En producción (PR #3). Probado por Diego en su Android (panel instalado); migraciones `20261020000001`–`…0005` en la nube; Diego es el primer admin |
| 3B | Inventario y proveedores (compras que suben stock, costos y ganancia) | Por planificar (fines de noviembre) |
| 4 | Avisos (Web Push a los admins, correos al comprador en cada paso), respaldos cifrados diarios/semanales y consulta diaria contra la pausa | Programado y probado (PR #4); falta configurar la nube con Diego y fusionar |
| 5 | Dashboard con gráficos (ventas, inventario, ganancia, clientes) | Por planificar (primera quincena de diciembre) |
| Etapa 2 | Estadísticas avanzadas, demo de portafolio, fotos reales del Illimani, dominio propio | Diciembre |

**Pendientes y detalles menores anotados:**
- **Buscador:** el `*` funciona como comodín.
- **Accesibilidad:** el texto "Close" del Sheet está en inglés.
- **Almacenamiento:**
  - faltan pruebas pgTAP de las políticas de storage;
    - se pueden subir capturas sin límite mientras el pedido espera pago.
- **Carrito:**
  - con más de 30 productos distintos o un id corrupto se vacía;
  - falta un reintento si falla la carga de productos;
  - el mensaje "sin stock" también aparece cuando un producto se ocultó.
- **Pedidos:**
  - los textos libres no tienen largo máximo;
  - dos envíos simultáneos con el mismo `request_id` muestran un error genérico.
- **Varios:**
  - el CI hace el build dos veces;
  - `shadcn` está en `dependencies`;
  - `metadataBase` usa una dirección de respaldo si falta `NEXT_PUBLIC_SITE_URL`.
- **Plan 3A** (decisiones en el PR #3; detalles menores para el plan 3B):
  - fotos de más de 10 MB se rechazan antes de comprimir (50/108 MP);
  - archivos huérfanos en Storage en algunos errores de subida;
  - la sección "Productos de prueba" no desaparece después de usarla;
  - el aviso de apartadas puede nombrar un pedido ya pagado;
  - faltan pgTAP de storage.objects para compradores y de `admin_void_manual_sale` como comprador;
  - en PC, pedidos sin vista de dos columnas (lista + detalle); historial limitado a 100;
  - botón Atrás de Android con un diálogo abierto; botones de fotos de 40 px;
  - "Ver la tienda" en Más todavía precarga la portada;
  - las pruebas de ajustes corren solo en PC (cambian datos de toda la tienda);
  - el nombre del panel instalado ("Ludiq · Panel") está fijo en `public/panel.webmanifest`;
  - las fotos se reordenan con "Hacer principal" (no arrastrando).

## 8. Lecciones (trampas ya resueltas, no repetir)

1. **Next 16 cambió:** `middleware` ahora es `proxy.ts`, `revalidate` no existe con `cacheComponents` (se usa `"use cache"` + `cacheLife` + `cacheTag`) y `error.tsx` recibe `retry`. Antes de programar, leer `node_modules/next/dist/docs/` (lo pide AGENTS.md).
2. **Leer `params` fuera de `<Suspense>`** con productos que no estaban en el build → **500 en Netlify**. Se reprodujo con `npx netlify-cli serve --offline`.
3. **`notFound()` después de empezar el streaming** responde 200 con `noindex`, no 404. Es el comportamiento documentado de Next.
4. **El cliente de Supabase usa `Date.now()`** → con las precargas parciales hay que llamar a `await connection()` antes.
5. **La regla de Turbopack de Tailwind (`*.css`)** rompía los CSS modules → se agregó `condition: { not: { path: /\.module\.css$/ } }`.
6. **shadcn 4.22 genera `import { cn } from "cn"`** → corregirlo a `@/lib/utils` cada vez que se agregue un componente.
7. **`netlify.toml`** debe declarar `@netlify/plugin-nextjs` y `publish = ".next"`; si no, Netlify publica el sitio como estático y todo da 404.
8. **Netlify protege las vistas previas** con login por defecto; para probarlas con Playwright hay que hacerlas públicas.
9. **En emulación móvil de Playwright, `innerWidth` crece con el contenido** → para detectar scroll horizontal, comparar `scrollWidth` con `clientWidth`.
10. **React no dispara `onChange`** si se elige el mismo archivo que ya tenía el input antes de hidratar → el helper de las e2e vacía el input y reintenta.
11. **La caché `"use cache"` en `.next` sobrevive entre builds** → después de `supabase db reset`, borrar `.next` (`npm run db:reset`).
12. **pgTAP no debe depender de datos de otras corridas:** cada prueba usa sus propios registros dentro de una transacción.
13. **SMTP de Gmail:** necesita la verificación en 2 pasos y una contraseña de aplicación de 16 letras sin espacios, con el usuario y el remitente iguales al Gmail. El error `535 5.7.8` significa credenciales incorrectas y se ve en *Logs → Auth*. Para las llamadas a `/auth/v1/admin` se usa la clave `service_role` legacy (la `sb_secret_` nueva da 401).
14. **Shell:** nunca usar `pkill -f` con un patrón que aparezca en el propio comando, porque mata la terminal. Hay otro `next-server` del usuario (v16.3.6) que no hay que tocar.
15. **Node 22** se carga con `source ~/.nvm/nvm.sh`; la terminal no interactiva usa v20.
16. **Precarga + `updateTag`:** un `<Link>` a la ficha pública dentro de la pantalla donde se edita el producto llenaba la caché de `getProductBySlug` mientras se guardaba, y la tienda seguía mostrando el precio viejo. En pantallas que editan datos públicos, esos enlaces van con `prefetch={false}`.
17. **Next 16 conserva la página anterior oculta (Activity)** en el DOM: en las e2e, `getByLabel` puede encontrar dos campos; usar `getByRole`, que ignora lo oculto.
18. **Un elemento flex con filas que se desplazan** (`overflow-x-auto` + `whitespace-nowrap`) ensancha la página si no tiene `min-w-0`; en una grilla, `grid-cols-[minmax(0,1fr)]` con textos `truncate`.
19. **Pruebas que cambian datos compartidos** (stock de un producto del seed, ajustes, totales de la portada) no deben correr a la vez en PC y celular: usar datos propios (`createProduct`), un solo proyecto o un proyecto que corre al final.
20. **Edge Functions en local:** el runtime solo carga las funciones que existen al hacer `supabase start` (una nueva requiere reiniciar) y los secretos locales van en `supabase/functions/.env` — **nunca** en `[edge_runtime.secrets]` de `config.toml`, porque la CLI los sube a la nube (pasó: producción quedó con el buzón de prueba y claves VAPID locales). Desde dentro de Docker se usan los alias `kong` e `inbucket`: el resolvedor de Deno rechaza nombres con guion bajo (`supabase_inbucket_web_venta`).
21. **`web-push` solo habla HTTPS** y Chromium sin interfaz no puede suscribirse a un servicio de push: en las e2e se reemplaza `PushManager` y el permiso; el aviso real se prueba en el celular.
22. **Cada corrida e2e crea admins nuevos** y cada aviso de pago escribe a todos: `reset-db` les quita el rol al empezar.

## 9. Cuentas y servicios

- **Supabase:** proyecto `web_tienda` (ref `lpnlqezlwsmrtywzotrf`).
- **Netlify:** sitio `ludiq-lapaz`.
- **GitHub:** `Vega-Mtz-JD/web_jugueteria_venta`.
- **Configuración en la nube** (SMTP, URLs, plantillas, Google): ver [hosting.md](hosting.md).
- **Secretos:** nunca van en el repositorio. En Netlify solo están `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_SITE_URL`.
