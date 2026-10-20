# Plan 4 — Avisos y respaldos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando un comprador sube la captura de su pago, el celular de cada administrador que lo active suena con un aviso que abre ese pedido (y les llega un correo de respaldo). El comprador recibe un correo en cada paso de su pedido. La base y los archivos se respaldan solos, cifrados, y Supabase no se pausa.

**Architecture:** La base es la que avisa: un trigger sobre `order_events` deja cada aviso en la cola `notification_outbox`, en la misma transacción que el cambio de estado (si avisar falla, la compra igual se guarda). Al insertar, `pg_net` despierta a la Edge Function `notify` de Supabase. La función toma los avisos pendientes con `claim_notifications` (`for update skip locked`, así cada uno sale una vez) y manda el Web Push (`jsr:@negrel/webpush`) y el correo (`npm:nodemailer` por el Gmail que ya usan las cuentas, puerto 465). Un `pg_cron` cada 5 minutos reintenta lo que quedó pendiente. Los respaldos corren en GitHub Actions: `supabase db dump` diario y las fotos y capturas cada semana, cifrados con `gpg` antes de subirse como artefactos.

**Tech Stack:** el del proyecto, más Supabase Edge Functions (Deno), `pg_net`, Vault, Web Push (VAPID), service worker propio y GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md`: §5.6 avisos, §4 (respaldos, consulta diaria contra la pausa, correo con SMTP propio) y el aviso por correo de la cancelación automática (§ estados, "se cancela solo… y se avisa al comprador por correo"). Diego eligió arrancar directo: las decisiones de abajo marcadas **[mía]** van al registro como rulings ya tomadas.

## Global Constraints

- Todas las reglas de `CLAUDE.md`: Node 22 (`source ~/.nvm/nvm.sh`), Next 16 (`<Suspense>` para cookies/params), base fuente de verdad, RLS en toda tabla nueva, TDD, mensajes en español y Bs con `formatBs`.
- **Nunca bloquear un pedido por un aviso.** Insertar en la cola nunca lanza error, aunque falten los secretos o `pg_net` falle.
- **Secretos fuera del repo.** En la nube: `npx supabase secrets set` (función) y Vault (`notify_url`, `notify_secret`). En el repo solo quedan los valores locales de prueba de `[edge_runtime.secrets]` en `supabase/config.toml`, que apuntan a Mailpit, con un comentario "solo local" **[mía]**. Netlify solo agrega `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Avisos a admins: Web Push a cada suscripción de cada admin y un correo de respaldo a cada admin. El ejemplo exacto del spec: **"Nuevo pedido #0231 · Bs 570 · Encomienda a Cochabamba"**; al tocarlo se abre `/panel/pedidos/<id>`.
- Correos al comprador: pedido recibido, pago confirmado, pago rechazado (con motivo), enviado / listo para recoger, cancelado por el sistema o por el admin y reembolsado. Estos dos últimos son **[míos]**: el comprador debe saber que su pedido murió. No hay correo cuando cancela el propio comprador ni al pasar a `entregado`.
- Remitente: `MAIL_FROM` = `Ludiq <universitywebsite2026@gmail.com>`. Las horas van en `America/La_Paz`.
- Reintentos: hasta 5 por aviso. Pasados los 5 queda con `last_error` y no se vuelve a intentar.
- Respaldos: base diario a las 04:00 La Paz (`0 8 * * *` UTC) y Storage semanal (domingo 05:00 La Paz). Se guardan como artefactos de 30 días, **siempre cifrados** con `gpg --symmetric --cipher-algo AES256`: el repo es público.
- Rama `feat/plan-4-avisos`, PR a `main` y una sola fusión con el visto bueno de Diego.

## Review Focus

1. **Gmail caído o con la contraseña mal, o la función sin desplegar**: el pedido se guarda igual y el aviso queda pendiente con `last_error`; se reintenta y nunca sale dos veces si ya salió → pgTAP Tarea 1 y Vitest Tarea 2 (`dispatch`).
2. **Una suscripción vieja (celular cambiado, 404/410)**: se borra, y los demás admins reciben igual → Vitest Tarea 2.
3. **El trigger y el cron despiertan a la función a la vez**: cada aviso se envía una vez → pgTAP Tarea 1 (`claim` con `skip locked`).
4. **Segunda captura después de un rechazo**: el aviso dice "Nueva captura del pedido #0231", no "Nuevo pedido" → Vitest Tarea 2.
5. **Navegador sin Web Push o con el permiso bloqueado** (iPhone sin instalar, PC que dijo "Bloquear"): el panel lo explica en una línea y todo lo demás funciona → e2e Tarea 4.

---

## Estructura de archivos

```
supabase/migrations/20261021000001_avisos.sql      # cola, suscripciones, trigger, claim/finish, wake_notifier, cron
supabase/tests/avisos.test.sql
supabase/functions/notify/index.ts                 # Edge Function (Deno): auth, claim, envío, finish
supabase/functions/_shared/messages.ts             # textos de push y correo (TS puro, probado con Vitest)
supabase/functions/_shared/dispatch.ts             # envía un aviso con dependencias inyectadas (probado con Vitest)
supabase/functions/_shared/*.test.ts
supabase/config.toml                               # [functions.notify] verify_jwt=false + [edge_runtime.secrets] locales
supabase/seed.sql                                  # Vault local: notify_url / notify_secret
public/panel-sw.js                                 # service worker: push + notificationclick
src/features/admin/push/ (PushToggle.tsx, push-actions.ts, vapid.ts + test)
.github/workflows/respaldo-base.yml · respaldo-archivos.yml
scripts/backup-storage.mjs (+ scripts/backup-storage.int.test.ts)
e2e/avisos-correo.spec.ts · e2e/panel-avisos.spec.ts
```

---

### Task 1: Cola de avisos en la base

**Files:**
- Create: `supabase/migrations/20261021000001_avisos.sql`, `supabase/tests/avisos.test.sql`
- Modify: `supabase/seed.sql` (Vault local), `src/lib/supabase/database.types.ts` (regenerar)

**Interfaces:**
- Produces:
  - `notification_outbox(id bigint identity pk, order_id uuid → orders on delete cascade, kind text not null check (kind in ('pedido_recibido','pago_por_revisar','nueva_captura','pago_confirmado','pago_rechazado','enviado','listo_para_recoger','cancelado','reembolsado','prueba')), audience text not null check (audience in ('admins','cliente')), target_user_id uuid, created_at, attempts int default 0, locked_until timestamptz, sent_at timestamptz, last_error text)`. Para `prueba`, `order_id` es nulo. RLS activa y sin políticas: nadie la lee por la API.
  - Trigger `order_events_enqueue` (after insert on `order_events`). Mapeo por `to_status` y `from_status`:
    - `esperando_pago` sin estado anterior ⇒ `pedido_recibido` (cliente);
    - `en_revision` desde `esperando_pago` ⇒ `pago_por_revisar` (admins);
    - `en_revision` desde `rechazado` ⇒ `nueva_captura` (admins);
    - `pagado` ⇒ `pago_confirmado`;
    - `rechazado` ⇒ `pago_rechazado`;
    - `enviado` ⇒ `enviado`;
    - `listo_para_recoger` ⇒ `listo_para_recoger`;
    - `cancelado` con `actor <> 'cliente'` ⇒ `cancelado`;
    - `reembolsado` ⇒ `reembolsado`.
    
    Los últimos seis son para el cliente. Cualquier otro caso no encola nada.
  - `push_subscriptions(id uuid pk, user_id uuid → profiles on delete cascade, endpoint text unique not null, p256dh text not null, auth text not null, user_agent text, created_at)`. RLS: cada usuario lee y borra las suyas; inserta solo si `is_admin()` y `user_id = auth.uid()`.
  - `wake_notifier() returns void`. Lee `notify_url` y `notify_secret` de `vault.decrypted_secrets`; si existen, hace `net.http_post(url, '{}', headers := {"Authorization": "Bearer <secret>"})`. Cualquier error queda en un `exception when others then null`. Lo llaman un trigger `after insert … for each statement` sobre la cola y el cron `reintentar-avisos` (`*/5 * * * *`), este último solo si hay pendientes.
  - `claim_notifications(p_limit int default 20) returns jsonb` (array). Toma los pendientes (`sent_at is null and attempts < 5 and (locked_until is null or locked_until < now())`) `for update skip locked`, les pone `attempts+1` y `locked_until = now()+interval '5 minutes'`, y devuelve por cada uno:
    - `id`, `kind`, `audience`, `targetUserId`;
    - del pedido: `order {id, number, totalCents, subtotalCents, deliveryFeeCents, deliveryMethod, zoneName, city, department, rejectionReason, shippingAgency, trackingCode, statusChangedAt, note}`, donde `note` es la nota del último evento;
    - `customer {email, name}`;
    - `admins [{userId, email}]`;
    - `store {name, address, pickupHours, whatsappPhone}`.
  - `finish_notification(p_id bigint, p_error text) returns void`. Con `p_error` nulo pone `sent_at = now()`; si no, guarda `last_error` y libera `locked_until`.
  - `claim_notifications` y `finish_notification` llevan `execute` solo para `service_role` (revocado de `public, anon, authenticated`).
  - `admin_send_test_push() returns void` (security definer, `require_admin()`): encola un `prueba` / `admins` con `target_user_id = auth.uid()`.
- `create extension if not exists pg_net with schema extensions`.

- [ ] **Step 1: pgTAP que falla** `avisos.test.sql`, con usuarios y productos propios:
  - `create_order` ⇒ 1 fila `pedido_recibido` / `cliente`;
  - `submit_payment_proof` ⇒ `pago_por_revisar` / `admins`;
  - rechazar y volver a subir ⇒ `nueva_captura`;
  - cada transición de `admin_set_order_status` ⇒ su `kind`;
  - `cancel_order_by_customer` ⇒ nada;
  - `expire_orders` ⇒ `cancelado`;
  - sin secretos en Vault, el pedido se crea igual (`lives_ok`);
  - `claim_notifications(10)` devuelve los pendientes con `order.number`, `customer.email` y `admins`; un segundo `claim` inmediato devuelve `[]`; con `finish(id, null)` ⇒ `sent_at` no nulo; con `finish(id, 'x')` cinco veces ⇒ no vuelve a salir;
  - como cliente: `select` de la cola ⇒ 0 filas, `claim` ⇒ error de permisos, e insertar una suscripción ⇒ error de RLS;
  - como admin: insertar su suscripción ⇒ ok, e insertar una para otro usuario ⇒ error.
- [ ] **Step 2: Correr** `npx supabase db reset && npm run db:test` → FAIL.
- [ ] **Step 3: Implementar** la migración. En `seed.sql`, Vault local con `notify_url = 'http://supabase_kong_web_venta:8000/functions/v1/notify'` y `notify_secret = 'local-notify-secret'`. Comprobar en este paso que el contenedor de la base resuelve ese nombre (`select net.http_get(...)` y luego `net._http_response`); si no lo resuelve, usar `host.docker.internal:54321` y anotar el ruling.
- [ ] **Step 4: Correr** → PASS (todas las suites); `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): cola de avisos, suscripciones push y despertador del notificador`.

---

### Task 2: Textos y envío (TS puro, probado con Vitest)

**Files:**
- Create: `supabase/functions/_shared/messages.ts`, `supabase/functions/_shared/dispatch.ts`, `supabase/functions/_shared/messages.test.ts`, `supabase/functions/_shared/dispatch.test.ts`
- Modify: `vitest.config.ts` (incluir `supabase/functions/_shared/**/*.test.ts`), `tsconfig.json` y `eslint.config.mjs` (excluir `supabase/functions/**` salvo `_shared`, que no importa nada de Deno)

**Interfaces:**
- Consumes: el JSON de `claim_notifications` (Tarea 1) como tipo `ClaimedNotification`.
- Produces:
  - `buildPush(n: ClaimedNotification): { title: string; body: string; url: string; tag: string }`
  - `buildEmails(n: ClaimedNotification, siteUrl: string): { to: string; subject: string; html: string; text: string }[]`. Para `admins` es uno por admin; para `cliente`, uno al comprador.
  - `dispatch(n, deps: { siteUrl; sendMail(m) ; sendPush(sub, payload): Promise<{ gone: boolean }> ; subscriptionsFor(userIds: string[]): Promise<Sub[]> ; deleteSubscription(id) }): Promise<{ error: string | null }>`. Solo hace push si `audience = 'admins'`; con `prueba`, solo a `targetUserId`. Un push con `gone` borra esa suscripción y no cuenta como error. El error es el primero de los correos o pushes que fallaron.
- Textos exactos (`#0231` = `formatOrderCode`, montos con `formatBs`; las entregas se dicen "Recojo en tienda", "Envío a <zona>" y "Encomienda a <ciudad>"):

  | kind | push / asunto | cuerpo (resumen) |
  |---|---|---|
  | `pago_por_revisar` | "Nuevo pedido #0231 · Bs 570 · Encomienda a Cochabamba" | "Toca para revisar la captura" |
  | `nueva_captura` | "Nueva captura del pedido #0231 · Bs 570" | "El comprador subió otra captura después del rechazo" |
  | `prueba` | "Avisos activados" | "Así te avisaremos cuando llegue un pago" |
  | `pedido_recibido` | "Recibimos tu pedido #0231" | total, "Paga con QR y sube la captura en los próximos 60 minutos", enlace `/pedidos/<id>/pago` |
  | `pago_confirmado` | "Confirmamos tu pago del pedido #0231" | qué sigue según la entrega |
  | `pago_rechazado` | "No pudimos confirmar el pago del pedido #0231" | "Motivo: <motivo>", "Puedes subir otra captura durante 48 horas", enlace al pago |
  | `enviado` | "Tu pedido #0231 va en camino" | encomienda: "Agencia <x> · Guía <y>" |
  | `listo_para_recoger` | "Tu pedido #0231 está listo para recoger" | dirección y horario de la tienda |
  | `cancelado` | "Tu pedido #0231 se canceló" | nota del evento (p. ej. "Venció sin pago") y WhatsApp de la tienda |
  | `reembolsado` | "Reembolsamos tu pedido #0231" | "El dinero se devuelve por fuera de la web; si tienes dudas, escríbenos por WhatsApp" |

  La `url` del push es `/panel/pedidos/<id>` (`/panel` para `prueba`), y el `tag` es el id del pedido (así un aviso nuevo del mismo pedido reemplaza al anterior). El HTML es simple y en línea, con el nombre de la tienda, un botón "Ver mi pedido" y, en los correos a admins, "Abrir en el panel". Todo texto del comprador va escapado.
- [ ] **Step 1: Pruebas que fallan:**
  - el push de `pago_por_revisar` con encomienda a Cochabamba, `totalCents` 57000 y número 231 tiene el título exacto del spec;
  - `nueva_captura` tiene su título;
  - el correo `pago_rechazado` contiene "Motivo: Monto incorrecto";
  - un motivo con `<script>` queda escapado;
  - `dispatch` con dos admins, cada uno con una suscripción, donde una devuelve `gone`: borra esa, manda el otro push y los dos correos, y devuelve `{ error: null }`;
  - con `sendMail` que lanza "535" ⇒ `{ error }` que contiene "535";
  - un aviso de `cliente` no consulta suscripciones;
  - `prueba` solo va a `targetUserId`.
- [ ] **Step 2: Correr** `npx vitest run supabase/functions/_shared` → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS; `npm run typecheck && npm run lint` en verde.
- [ ] **Step 5: Commit** `feat(avisos): textos de push y correo y envío con reintento`.

---

### Task 3: Edge Function `notify` y correos de punta a punta

**Files:**
- Create: `supabase/functions/notify/index.ts`, `e2e/avisos-correo.spec.ts`
- Modify: `supabase/config.toml`
  - `[functions.notify] verify_jwt = false` (la protege el secreto propio);
  - `[edge_runtime.secrets]` solo local: `NOTIFY_SECRET = "local-notify-secret"`, `SMTP_HOST = "inbucket"`, `SMTP_PORT = "1025"`, `SMTP_SECURE = "false"`, `MAIL_FROM = "Ludiq <avisos@ludiq.local>"`, `SITE_URL = "http://localhost:3000"` y un par VAPID local generado con `npx web-push generate-vapid-keys`.

**Interfaces:**
- Consumes: `claim_notifications` / `finish_notification` (Tarea 1); `dispatch`, `buildPush` y `buildEmails` (Tarea 2).
- Produces: `POST /functions/v1/notify`.
  - Sin `Authorization: Bearer <NOTIFY_SECRET>` ⇒ 401.
  - Si no, repite `claim_notifications(20)` hasta recibir `[]`. Por cada aviso llama `dispatch` y después `finish_notification`, y responde `{ sent, failed }`.
  - Usa el cliente de Supabase con `SUPABASE_SERVICE_ROLE_KEY` (lo trae el runtime).
  - Push con `jsr:@negrel/webpush` (VAPID de `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT = "mailto:<MAIL_FROM>"`); un 404/410 ⇒ `gone`.
  - Correo con `npm:nodemailer` (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`).
- [ ] **Step 1: e2e que falla** `avisos-correo.spec.ts` (mira los correos en Mailpit con `latestEmailHtml`, que espera hasta 10 s):
  - un comprador compra por checkout ⇒ le llega "Recibimos tu pedido #…" con el enlace de pago;
  - sube la captura ⇒ al admin de prueba le llega "Nuevo pedido #… · Bs …";
  - el admin rechaza con "Monto incorrecto" ⇒ al comprador le llega "Motivo: Monto incorrecto";
  - vuelve a subir y el admin confirma ⇒ "Confirmamos tu pago…".
  - `POST` sin secreto ⇒ 401.
- [ ] **Step 2: Correr** → FAIL (no existe la función).
- [ ] **Step 3: Implementar.** Confirmar que `npx supabase start` sirve la función con los secretos de `config.toml` (en local y en el job `db` del CI). Si no los sirve, agregar `npx supabase functions serve --env-file …` como segundo `webServer` de Playwright y como paso del CI, y anotar el ruling.
- [ ] **Step 4: Correr** → PASS; también la suite e2e completa (los correos no deben frenar ni romper otras pruebas).
- [ ] **Step 5: Commit** `feat(avisos): función notify con Web Push y correos al comprador`.

---

### Task 4: Avisos en el celular desde el panel

**Files:**
- Create: `public/panel-sw.js`, `src/features/admin/push/vapid.ts` (+ `vapid.test.ts`), `src/features/admin/push/push-actions.ts`, `src/features/admin/push/PushToggle.tsx`, `e2e/panel-avisos.spec.ts`
- Modify: `src/app/panel/mas/page.tsx` (sección "Avisos en este dispositivo"), `.env.example` (`NEXT_PUBLIC_VAPID_PUBLIC_KEY=`), `.env.local` (la clave pública local de la Tarea 3)

**Interfaces:**
- Consumes: `push_subscriptions` (Tarea 1); `prueba` de la cola (Tareas 1 y 2).
- Produces:
  - `urlBase64ToUint8Array(base64: string): Uint8Array`.
  - Server Actions con `isAdminSession()`: `saveSubscriptionAction({ endpoint, p256dh, auth, userAgent })` (hace upsert por `endpoint`), `removeSubscriptionAction(endpoint)` y `sendTestPushAction()`. Esta última inserta un `prueba` con `target_user_id = auth.uid()` mediante una RPC `admin_send_test_push()` de la Tarea 1 (security definer, `require_admin`).
  - `panel-sw.js`:
    - `push` ⇒ `showNotification(title, { body, icon: "/icons/panel-192.png", badge: "/icons/panel-192.png", tag, data: { url } })`;
    - `notificationclick` ⇒ enfoca una ventana del panel y navega a `url`, o abre una nueva.
    
    Se registra con `scope: "/panel"`.
  - `PushToggle` tiene estos estados y textos:
    - "Este navegador no permite avisos. En iPhone, primero instala el panel en la pantalla de inicio.";
    - permiso bloqueado ⇒ "Los avisos están bloqueados. Actívalos en los ajustes del navegador para este sitio.";
    - apagado ⇒ botón "Activar avisos";
    - activado ⇒ "Avisos activados en este dispositivo", más los botones "Enviar aviso de prueba" y "Desactivar".
- [ ] **Step 1: Pruebas que fallan:**
  - unit: `urlBase64ToUint8Array` con una clave VAPID conocida;
  - e2e (`addInitScript` con un `PushManager.subscribe` falso que devuelve un endpoint fijo, más `context.grantPermissions(["notifications"])`):
    - "Activar avisos" ⇒ fila en `push_subscriptions` para el admin y el texto de activado;
    - "Enviar aviso de prueba" ⇒ fila `prueba` en la cola;
    - "Desactivar" ⇒ se borra la fila;
    - con el permiso `denied` ⇒ el texto de bloqueado;
    - sin `PushManager` ⇒ el texto de no soportado.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): activar avisos en el celular`.

---

### Task 5: Respaldos y consulta diaria

**Files:**
- Create: `.github/workflows/respaldo-base.yml`, `.github/workflows/respaldo-archivos.yml`, `scripts/backup-storage.mjs`, `scripts/backup-storage.int.test.ts`
- Modify: `vitest.config.ts` (las int incluyen `scripts/**/*.int.test.ts`)

**Interfaces:**
- `respaldo-base.yml`:
  - se dispara con `schedule: "0 8 * * *"` y con `workflow_dispatch`;
  - pasos `supabase db dump --db-url "$SUPABASE_DB_URL"` × 3 (`--role-only`, esquema, `--data-only --use-copy`) ⇒ `tar czf` ⇒ `gpg --batch --yes --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" --symmetric --cipher-algo AES256` ⇒ `actions/upload-artifact` con el nombre `respaldo-base-<fecha>` y `retention-days: 30`, que sube solo el `.gpg`;
  - después, una consulta liviana `curl -fsS "$SUPABASE_URL/rest/v1/store_settings?select=store_name" -H "apikey: $SUPABASE_ANON_KEY"`;
  - secretos: `SUPABASE_DB_URL` (la cadena del **pooler de sesión**, IPv4) y `BACKUP_PASSPHRASE`; variables: `SUPABASE_URL` y `SUPABASE_ANON_KEY`.
- `respaldo-archivos.yml`: `schedule: "0 9 * * 0"` y `workflow_dispatch`; `node scripts/backup-storage.mjs out/` ⇒ tar ⇒ gpg ⇒ artefacto `respaldo-archivos-<fecha>`, 30 días. Secreto: `SUPABASE_SERVICE_ROLE_KEY`.
- `backup-storage.mjs <dir>`: con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` recorre `payment-proofs`, `shipping-proofs`, `product-images` y `store-assets` (paginando y entrando a las carpetas), descarga todo a `<dir>/<bucket>/<ruta>` e imprime `N archivos`.
- [ ] **Step 1: Prueba de integración que falla:** sube 2 archivos a `product-images` y 1 a `payment-proofs` en la base local, corre el script hacia una carpeta temporal y verifica que los 3 existen con el mismo contenido.
- [ ] **Step 2: Correr** `npm run test:int` → FAIL. **Step 3: Implementar** (script y los dos workflows). **Step 4: Correr** → PASS; `npx actionlint` si está disponible (si no, revisar el YAML a mano).
- [ ] **Step 5: Commit** `feat(respaldos): base diaria y archivos semanales cifrados, con consulta contra la pausa`.

---

### Task 6: Publicación

- [ ] **Step 1: Docs.** `docs/hosting.md` explica:
  - los secretos de la función (cuáles pone Diego, como `SMTP_PASS`, y cuáles pongo yo, como VAPID y `NOTIFY_SECRET`);
  - el SQL de Vault en la nube (`select vault.create_secret('https://lpnlqezlwsmrtywzotrf.supabase.co/functions/v1/notify', 'notify_url')` y lo mismo para `notify_secret`);
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` en Netlify;
  - los secretos y variables de GitHub;
  - cómo descifrar y restaurar un respaldo (`gpg -d`, `psql -f roles.sql`, `schema.sql` y `data.sql` en un proyecto nuevo);
  - el aviso de que GitHub apaga los workflows programados tras 60 días sin actividad en el repo.
  
  `docs/PROYECTO.md` lleva el estado, la cola de avisos y las lecciones.
- [ ] **Step 2: [Diego + yo] Nube:**
  1. `npx supabase db push`.
  2. Diego pone `SMTP_USER`/`SMTP_PASS` con `! npx supabase secrets set …`; yo pongo el resto sin mostrarlos.
  3. `npx supabase functions deploy notify --no-verify-jwt`.
  4. Diego corre el SQL de Vault.
  5. Variable en Netlify.
  6. Secretos de GitHub con `! gh secret set …`.
- [ ] **Step 3: Prueba real:**
  - en la vista previa, el admin activa avisos en su Android y toca "Enviar aviso de prueba" ⇒ suena;
  - una compra de prueba con captura ⇒ push "Nuevo pedido…" que abre el pedido, y un correo real al comprador;
  - correr los dos workflows con `workflow_dispatch` ⇒ artefactos `.gpg`, y Diego descifra uno con su frase para comprobarlo.
  
  Si Gmail no acepta el puerto 465 desde la función, ver el ruling previsto: un `Route Handler` de Next con nodemailer y el mismo contrato.
- [ ] **Step 4: Revisión final** (executing-plans) con su Review Focus; correcciones con TDD.
- [ ] **Step 5: Merge** con el visto bueno de Diego; verificar producción; `npx repomix` y la memoria (en la rama, antes de fusionar).
