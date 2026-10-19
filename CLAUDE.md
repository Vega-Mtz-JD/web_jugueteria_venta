# Ludiq — tienda de juegos de mesa (La Paz, Bolivia)

@AGENTS.md

Contexto completo (idea, decisiones, arquitectura, estado y lecciones): `docs/PROYECTO.md`. Spec: `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md`. Planes: `docs/superpowers/plans/`. Nube: `docs/hosting.md`.

## Reglas del proyecto
- Responder y escribir la interfaz **en español**. Moneda `Bs` en centavos (`formatBs`); documento CI; Bolivia (no Perú).
- **Node 22**: anteponer `source ~/.nvm/nvm.sh >/dev/null;` a los comandos (la shell no interactiva usa Node 20).
- **Next 16 + Cache Components**: leer la guía en `node_modules/next/dist/docs/` antes de usar una API; `cookies()/params/searchParams` siempre dentro de `<Suspense>`; datos públicos con `"use cache"` en `src/features/catalog/cached.ts`; cliente con sesión vía `createServerSupabase()` (ya llama `connection()`).
- **La base es la fuente de verdad**: precios, stock y estados de pedido solo cambian vía funciones RPC (`supabase/migrations`), con RLS en todas las tablas. Mensajes para el comprador con `errcode 'P0001'`.
- **TDD**: primero la prueba que falla. Comandos: `npm test` · `npm run test:int` · `npm run db:test` · `npm run test:e2e` (repone el seed y compila desde cero) · `npm run lint` · `npm run typecheck`.
- Nueva migración = nuevo archivo `supabase/migrations/<timestamp>_<nombre>.sql`; luego `npm run db:types`. En la nube la sube Diego con `npx supabase db push` (pide su contraseña).
- shadcn genera `import { cn } from "cn"`: corregir a `@/lib/utils`.
- **Git**: ramas `feat/…` + PR a `main` (= producción en Netlify, 15 créditos por despliegue de 300/mes). Probar en la vista previa del PR y fusionar cambios agrupados, solo con el visto bueno de Diego.
- **Shell**: nunca `pkill -f` con un patrón que aparezca en el propio comando; no tocar el `next-server` v16.3.6 ajeno; matar procesos por PID.
- Contexto empaquetado para IA: `npx repomix` → `docs/contexto/repomix-proyecto.xml`.
