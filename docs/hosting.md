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
