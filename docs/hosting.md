# Hosting: Netlify (plan gratis) + Supabase (plan gratis)

Verificado el 18/10/2026. Fuentes: [Netlify — planes con créditos](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/), [Next.js 16 en Netlify](https://www.netlify.com/changelog/next-js-16-deploy-on-netlify/), [Next.js en Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

## Netlify, plan gratis

- **300 créditos al mes, con tope duro.** Si se acaban, el sitio se pausa hasta el mes siguiente.
- **Sí permite uso comercial.** No hay restricción para uso personal.
- Costo en créditos:

| Qué | Créditos |
|---|---|
| Cada despliegue a producción (`main`) | **15** |
| Vistas previas de Pull Request y despliegues de ramas | **0** (gratis) |
| Tráfico | 20 por GB |
| Peticiones | 2 por cada 10.000 |
| Cómputo de funciones (páginas renderizadas en el servidor) | 10 por GB-hora |

- **Next.js 16 y Cache Components:** funcionan sin configurar nada, mediante el adaptador OpenNext de Netlify. No hay que fijar su versión: Netlify lo actualiza en cada build.

### Reglas para no quedarse sin créditos

1. **Probar en las vistas previas de los Pull Requests**, que son gratis, y **juntar cambios** antes de fusionar a `main`. Meta: como máximo unos 8 despliegues a producción al mes (120 créditos).
2. **Fotos livianas.** El tráfico es lo que más consume. Las fotos de productos se comprimen al subirlas (plan 3) y `next/image` sirve el tamaño justo.
3. **Revisar el consumo** en el panel de Netlify a mitad de mes, sobre todo en diciembre.
4. **Si en diciembre se acerca al tope**, hay dos opciones:
   - pasar a un plan de pago de Netlify;
   - mudar la web a Cloudflare Workers con el adaptador OpenNext, que no cobra por despliegue. Antes habría que confirmar que soporta Cache Components.

### Funciones de Next.js a evitar

Ninguna de las usadas en el plan 1 tiene problemas en Netlify. Hasta tener una necesidad clara, conviene evitar:
- `runtime = "edge"` en páginas;
- funciones exclusivas de Vercel, como `@vercel/og` fuera de `next/og`, o Vercel KV/Blob.

## Supabase, plan gratis

- 500 MB de base de datos y 1 GB de archivos.
- **El proyecto se pausa si pasa 7 días sin uso.** El plan 4 agrega una consulta diaria para mantenerlo activo y un respaldo diario cifrado.
- Región: la más cercana a Bolivia disponible (São Paulo, `sa-east-1`).

## Variables de entorno en Netlify

| Variable | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase en la nube |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clave pública (anon/publishable) del proyecto |
| `NEXT_PUBLIC_SITE_URL` | la URL de Netlify, por ejemplo `https://<sitio>.netlify.app` |

## Cuentas (Supabase Auth) en la nube

Configurar una vez en el panel de Supabase del proyecto `lpnlqezlwsmrtywzotrf`:

1. **Correo (SMTP)** — *Authentication → Emails → SMTP Settings*. El SMTP incluido de Supabase envía muy pocos correos por hora; se usa el Gmail de la tienda:
   - Activar la verificación en 2 pasos de esa cuenta Gmail y crear una **contraseña de aplicación**.
   - Host `smtp.gmail.com`, puerto `465`, usuario = el Gmail, contraseña = la de aplicación, remitente "Ludiq".
   - Resend no sirve todavía: sin un dominio propio verificado solo envía al dueño de la cuenta.
2. **URLs** — *Authentication → URL Configuration*:
   - Site URL: `https://ludiq-lapaz.netlify.app`
   - Redirect URLs: `https://ludiq-lapaz.netlify.app/**` y `https://deploy-preview-*--ludiq-lapaz.netlify.app/**`
3. **Plantillas en español** — *Authentication → Emails → Templates*: copiar el contenido de `supabase/templates/confirmacion.html` en **Confirm signup** (asunto "Confirma tu cuenta") y `supabase/templates/recuperar.html` en **Reset password** (asunto "Recupera tu contraseña"). Usan `{{ .RedirectTo }}` + `token_hash` sobre `/auth/confirm`: el enlace vuelve al mismo sitio desde donde se pidió (producción o una vista previa, que deben estar en Redirect URLs) y funciona aunque se abra en otro dispositivo. Si se cambian las plantillas en el repo, hay que volver a pegarlas aquí.
4. **Confirmación de correo**: activada (*Authentication → Providers → Email → Confirm email*).
5. **Google** (opcional, diciembre): cliente OAuth "Aplicación web" en Google Cloud con redirección `https://lpnlqezlwsmrtywzotrf.supabase.co/auth/v1/callback`; ID y secreto en *Authentication → Providers → Google*. La web ya tiene `/auth/callback`; falta el botón (plan 2, Tarea 9).

## Migraciones y datos en la nube

- Subir cambios de esquema: `npx supabase db push` (sin `--include-seed`; el seed con productos de prueba se cargó una sola vez al crear el proyecto).
- Verificar: `npx supabase migration list --linked`.
- `npm run db:reset` es **solo local** (borra y recrea la base de Docker).

## Panel del dueño (`/panel`)

- **Primer administrador:** la persona crea su cuenta en la tienda y luego, en el *SQL Editor* de Supabase:
  ```sql
  update public.profiles set role = 'admin'
  where id = (select id from auth.users where lower(email) = lower('correo@ejemplo.com'));
  ```
  Desde ahí, los demás administradores (hijos) se agregan en **Panel → Más → Administradores** con el correo de su cuenta.
- **Instalar en el celular (Android, Chrome):** abrir `https://ludiq-lapaz.netlify.app/panel` con la cuenta admin → menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**. Abre directo en el panel.
- **QR reales:** Panel → Más → Ajustes → *Billeteras QR* → **Cambiar QR** (se guardan en el bucket `store-assets/qr/`).
- **Productos de prueba:** cuando estén cargados los reales, Ajustes → *Productos de prueba* (escribir BORRAR). Los que ya tienen pedidos solo se ocultan.
- **Buckets nuevos:** `shipping-proofs` (privado, comprobantes de encomienda) y `product-images` con límite de 5 MB y solo jpeg/png/webp/heic. Los crean las migraciones; no hay que configurarlos a mano.

## Avisos (Web Push y correos)

Cómo funciona: cada cambio de estado de un pedido deja un aviso en `notification_outbox`; la base despierta (pg_net) a la Edge Function `notify`, que manda el push a los celulares de los admins que lo activaron y los correos. Un `pg_cron` (`reintentar-avisos`, cada 5 min) reintenta lo pendiente, hasta 5 veces.

**Puesta en marcha en la nube (una sola vez):**

1. Migración: `npx supabase db push`.
2. Secretos de la función (no van al repo):
   ```bash
   npx supabase secrets set SMTP_USER=universitywebsite2026@gmail.com SMTP_PASS=<contraseña de aplicación de 16 letras>
   npx supabase secrets set SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_SECURE=true \
     MAIL_FROM="Ludiq <universitywebsite2026@gmail.com>" SITE_URL=https://ludiq-lapaz.netlify.app \
     VAPID_PUBLIC_KEY=<pública> VAPID_PRIVATE_KEY=<privada> NOTIFY_SECRET=<secreto largo al azar>
   ```
   Las claves VAPID se generan una vez (`node -e` con `crypto.createECDH("prime256v1")`, en base64url). La pública va también en Netlify.
3. Desplegar la función: `npx supabase functions deploy notify --no-verify-jwt`.
4. Vault (SQL Editor), con el mismo `NOTIFY_SECRET`:
   ```sql
   select vault.create_secret('https://lpnlqezlwsmrtywzotrf.supabase.co/functions/v1/notify', 'notify_url');
   select vault.create_secret('<NOTIFY_SECRET>', 'notify_secret');
   ```
5. Netlify → *Environment variables*: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = la clave pública (no es secreta). Se aplica en el siguiente despliegue.
6. En cada celular o PC: Panel → Más → **Activar avisos** → **Enviar aviso de prueba**. En iPhone, primero se instala el panel en la pantalla de inicio.

**Si un aviso no llega:** *Edge Functions → notify → Logs* muestra el error (p. ej. `535` = contraseña de Gmail). Los pendientes: `select kind, attempts, last_error from notification_outbox where sent_at is null order by id desc;`. Gmail permite unos 500 correos por día.

## Respaldos

- **Base:** `.github/workflows/respaldo-base.yml`, todos los días a las 04:00 (La Paz). Hace `supabase db dump` de roles, esquema y datos, lo cifra con `gpg` (AES256) y lo guarda como artefacto por 30 días. También hace una consulta liviana para que Supabase no se pause.
- **Archivos:** `.github/workflows/respaldo-archivos.yml`, los domingos 05:00: capturas, comprobantes, fotos y QR (`scripts/backup-storage.mjs`), cifrado igual.
- **Secretos de GitHub** (*Settings → Secrets and variables → Actions*):
  - Secrets: `SUPABASE_DB_URL` (Supabase → *Connect* → **Session pooler**, con la contraseña de la base: los runners de GitHub no tienen IPv6), `BACKUP_PASSPHRASE` (frase que solo conoce Diego; **sin ella los respaldos no se pueden abrir**), `SUPABASE_SERVICE_ROLE_KEY`.
  - Variables: `SUPABASE_URL` (`https://lpnlqezlwsmrtywzotrf.supabase.co`) y `SUPABASE_ANON_KEY`.
- **Probar a mano:** *Actions → Respaldo de la base → Run workflow*.
- **Restaurar:** descargar el artefacto, `gpg -d respaldo-base-AAAA-MM-DD.tar.gz.gpg | tar xz`, y en un proyecto nuevo de Supabase: `psql "<cadena de conexión>" -f respaldo/roles.sql -f respaldo/schema.sql -f respaldo/data.sql`. Los archivos se vuelven a subir a sus buckets con la misma ruta.
- **Ojo:** GitHub apaga los workflows programados si el repositorio pasa 60 días sin actividad; un commit o un *Run workflow* los reactiva.
