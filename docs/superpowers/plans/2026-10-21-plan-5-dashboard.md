# Plan 5 — Dashboard con gráficos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La portada del panel pasa a ser un resumen de todo: arriba, cuánto ganó en el período, comparado con el anterior y con barras; abajo, lo pendiente, qué volver a comprar, el inventario valorizado, los clientes y los pedidos por estado. Una página nueva, **Ventas**, muestra la lista que forma cada número, y su suma da exactamente lo mismo.

**Architecture:**
- **Una sola definición de venta**, en la base: `sales_lines(from, to)` devuelve una fila por línea vendida (web o manual), con su fecha de venta, canal y costo copiado (`sale_costs`). Todo lo demás se suma desde ahí.
  - `sales_totals(...)` es el único lugar donde se suman los totales. Lo usan la lista de ventas, el dashboard y las barras, así que coinciden por construcción, y además hay pruebas.
- **Los períodos se calculan en la base:** `dashboard_period(period, now)` y `dashboard_buckets(period, now)`, en hora de La Paz. La pantalla solo da formato.
- **Tres RPC de admin:**
  - `admin_dashboard_sales(period, now)`: todo lo que depende del período;
  - `admin_dashboard_now()`: pendientes, se está agotando e inventario;
  - `admin_sales_list(...)`: la página Ventas.

  La portada hace dos llamadas en paralelo.
- **Barras hechas a mano** (HTML/CSS) en un componente de servidor. Cada barra es un enlace a la lista de ventas.

**Tech Stack:** el del proyecto (Next 16 + Cache Components, Supabase, Tailwind + shadcn, zod, Vitest, Playwright, pgTAP). **Sin dependencias nuevas.**

**Spec:** `docs/superpowers/specs/2026-10-21-dashboard-design.md` (amplía el §5.8 y reemplaza la portada del §5.2 de `docs/superpowers/specs/2026-10-19-panel-dueno-design.md`). Contexto: `docs/PROYECTO.md`.

## Global Constraints

- Todas las reglas de `CLAUDE.md`: Node 22, Next 16 con `<Suspense>` para `searchParams`, la base como fuente de verdad, TDD y textos en español.
- **Sin `"use cache"`** en el dashboard ni en Ventas: son datos de admin con sesión (`createServerSupabase()`).
- Funciones admin: `security definer`, `set search_path = ''`, `perform public.require_admin()` (42501). Errores para la persona con `P0001`; `execute` revocado de `public, anon` y otorgado a `authenticated`. Las internas (`sales_lines`, `sales_totals`, `dashboard_period`, `dashboard_buckets`) revocadas a todos.
- **Qué es una venta (spec §5, exacto):**
  - **pedido web** en `pagado`, `enviado`, `listo_para_recoger` o `entregado`, con fecha = `max(order_events.created_at)` del evento a `pagado`;
  - **venta manual** con `voided_at is null` y fecha = `created_at`.
  - El monto es el precio de los productos; **el envío no es venta** (`shippingCents` aparte).
  - "N ventas" = pedidos + ventas manuales distintos; "M juegos" = unidades.
- **Ganancia** = Σ cantidad × (precio − costo) solo de las líneas con `sale_costs.unit_cost_cents` no nulo. Las líneas sin costo van en `withoutCostCents`. **Nunca** se usa el costo de hoy para una venta pasada.
- **Hora:** `America/La_Paz`. Las semanas empiezan el lunes.
- **Períodos (exactos):** `hoy`, `7dias`, `mes`, `mes-anterior`, `12meses`; por defecto `mes`. Botones: `Hoy · 7 días · Este mes · Mes anterior · 12 meses`.
- **Textos exactos:**
  - Comparación: `▲ Bs 350 más que septiembre` · `▼ Bs 120 menos que ayer` · `Igual que ayer`.
  - Con costos faltantes: `▲ Vendiste Bs 800 más que septiembre · la ganancia no se compara porque faltan costos`.
  - Aviso: `Bs 600 en ventas sin costo anotado: no entran en la ganancia`.
  - Clientes: `Solo cuenta la tienda web`.
  - Muestras: `No se cuentan N juegos de ejemplo; puedes borrarlos en Ajustes`.
- **Accesibilidad:** cada barra muestra su monto como texto, y la comparación lleva ▲/▼ y palabras, no solo color.
- Rama `feat/plan-5-dashboard`; PR a `main` y una sola fusión con el visto bueno de Diego.

## Review Focus

1. **Pedido reembolsado después de pagado**, o venta manual anulada: sale de todos los números del período (ventas, ganancia, barras, lista, clientes) → pgTAP Tarea 1.
2. **Venta a las 23:30 de La Paz** (03:30 UTC del día siguiente): cae en el día, la semana y el mes de La Paz → pgTAP Tareas 1 y 2.
3. **"Este mes" el 31 de marzo, comparado con febrero:** el período anterior se corta en el 1 de marzo, sin desbordar; con "Mes anterior" en enero, se compara con diciembre del año anterior → pgTAP Tarea 2.
4. **Un pedido con una línea con costo y otra sin costo:** cuenta como 1 venta; su monto se reparte entre la ganancia y "sin costo", y la suma da el total → pgTAP Tarea 1.
5. **Período sin ninguna venta, o con ganancia negativa:** la portada muestra ceros sin dividir por cero, las barras quedan planas o hacia abajo, y la comparación es neutra → unitarias Tarea 4 y e2e Tarea 6.

---

## Estructura de archivos

```
supabase/migrations/20261023000001_dashboard.sql     # sales_lines, sales_totals, períodos, 3 RPC
supabase/tests/dashboard_ventas.test.sql · dashboard.test.sql · dashboard_ahora.test.sql
src/features/admin/dashboard/
  period.ts (+ test)          # Period, PERIODS, parsePeriod, títulos y etiquetas
  compare.ts (+ test)         # compareLine
  bars.ts (+ test)            # barScale
  sales-filter.ts (+ test)    # parseSalesFilter, salesHref
  queries.ts                  # getDashboardSales, getDashboardNow, getSalesList (+ tipos)
  ProfitHero.tsx · ProfitBars.tsx · PendingCards.tsx · RestockSection.tsx · TopProducts.tsx (cliente)
  InventoryCard.tsx · CustomersOrders.tsx · PeriodTabs.tsx · SalesTable.tsx
src/app/panel/page.tsx (reemplazo) · src/app/panel/ventas/page.tsx (nueva)
src/app/panel/mas/page.tsx (enlace Ventas)
borrar: src/features/admin/SummaryCards.tsx, getDashboardSummary y DashboardSummary en src/features/admin/queries.ts
e2e/portada-panel.spec.ts (reescrito: portada + ventas, en serie)
```

---

### Task 1: Una sola definición de venta y la lista de ventas (base)

**Files:**
- Create: `supabase/migrations/20261023000001_dashboard.sql`, `supabase/tests/dashboard_ventas.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (`npm run db:types`)

**Interfaces:**
- Produces:
  - **`sales_lines(p_from timestamptz, p_to timestamptz)`** (interna, SQL `stable`). Devuelve `table(sold_at timestamptz, channel text, order_id uuid, order_number int, manual_sale_id uuid, customer_id uuid, product_id uuid, product_name text, quantity int, unit_price_cents int, unit_cost_cents int, delivery_fee_cents int)`.
    - Una fila por `order_items` de un pedido que cuenta, y una por `manual_sales` vigente, con `sold_at ∈ [p_from, p_to)`.
    - `channel`: `web`, `tienda` o `whatsapp`. El costo sale de un `left join sale_costs`.
    - `product_name`: para web, el guardado en `order_items`; para manual, el de `products`.
    - `delivery_fee_cents` solo en **una** línea por pedido (la de menor `order_items.id`) y 0 en las demás, para sumar el envío sin repetirlo.
  - **`sales_totals(p_from timestamptz, p_to timestamptz, p_channel text default null, p_without_cost boolean default false) returns jsonb`** (interna). Devuelve `{salesCents, count, units, costCents, profitCents, withoutCostCents, withoutCostUnits, shippingCents}`.
    - `count` = pedidos distintos + ventas manuales distintas.
    - `costCents` y `profitCents` salen solo de las líneas con costo.
    - Con `p_without_cost`, solo las líneas sin costo.
  - **`dashboard_period(p_period text, p_now timestamptz)`** (interna). Devuelve `table(cur_from timestamptz, cur_to timestamptz, prev_from timestamptz, prev_to timestamptz, list_from date, list_to date)`, con `D` = hoy y `M` = primer día del mes, en La Paz:

    | período | actual | anterior | lista |
    |---|---|---|---|
    | `hoy` | [D, now) | [D−1, now−1 día) | D..D |
    | `7dias` | [D−6, now) | [D−13, now−7 días) | D−6..D |
    | `mes` | [M, now) | [M−1 mes, least(M−1 mes + (now − M), M)) | M..D |
    | `mes-anterior` | [M−1 mes, M) | [M−2 meses, M−1 mes) | M−1 mes..M−1 día |
    | `12meses` | [M−11 meses, now) | [M−23 meses, now − 1 año) | M−11 meses..D |

    Un período desconocido da `P0001` `Período desconocido`. El extremo `now` es `p_now + 1 microsegundo`, para incluir una venta registrada en el mismo instante.
  - **`admin_sales_list(p_period text default null, p_from date default null, p_to date default null, p_channel text default null, p_without_cost boolean default false, p_limit int default 200) returns jsonb`**. Devuelve `{range: {from, to}, totals: <sales_totals>, rowCount, rows: [{soldAt, channel, orderId, orderNumber, manualSaleId, productId, productName, quantity, unitPriceCents, unitCostCents, profitCents}]}`.
    - **Rango:** con `p_period`, `list_from..list_to` de `dashboard_period(p_period, now())`; si no, `[p_from, p_to]` en días de La Paz (inclusive).
    - **Validación:**
      - sin período ni fechas, o con `p_from > p_to`, o con más de 800 días ⇒ `Revisa las fechas`;
      - canal fuera de `web`/`tienda`/`whatsapp` ⇒ `Canal desconocido`.
    - **Filas y totales:** las filas van por `sold_at desc`, hasta `p_limit` (máximo 500). **Los totales cubren todo el filtro.** `profitCents` es nulo si la fila no tiene costo.

- [ ] **Step 1: pgTAP que falla** `dashboard_ventas.test.sql`. Prepara un admin, un cliente, un producto A con costo inicial 3000 y precio 5000, y un producto B sin costo con precio 2000. Las fechas se fijan como postgres en `order_events.created_at` y `manual_sales.created_at`.
  - **Un pedido web con A×1 y B×1, pagado el 2026-10-10 a las 12:00 (La Paz)**, y una venta manual de A×2 a 4500 en tienda ese mismo día:
    - `admin_sales_list(null, '2026-10-10', '2026-10-10')` da `salesCents` 16000 (5000 + 2000 + 9000), `count` 2, `units` 4, `costCents` 9000, `profitCents` 5000 y `withoutCostCents` 2000;
    - comprobaciones: `salesCents` = `costCents` + `profitCents` + `withoutCostCents`, y `rowCount` 3.
  - **Canal:** `p_channel 'tienda'` da `salesCents` 9000 y `count` 1. **Sin costo:** `p_without_cost` da 1 fila y `salesCents` 2000.
  - **Envío:** con `delivery_fee_cents` 1500 en el pedido, `shippingCents` da 1500 (no 3000).
  - **Medianoche:** una venta manual a las `2026-10-10 23:30-04` cae en el 10 y no en el 11.
  - **Reembolso:** si el pedido pasa a `reembolsado`, `salesCents` del día baja a 9000 y `count` a 1. Si se anula la venta manual (`voided_at`), el día queda en 0.
  - **Igualdad con la portada de la etapa A**, con un pedido y una venta de hoy: `admin_dashboard_summary()->'salesToday'->>'cents'` = `admin_sales_list('hoy')->'totals'->>'salesCents'`, y lo mismo para `count`. Lo mismo entre `salesMonth` y `admin_sales_list('mes')`.
  - **Errores:**
    - sin admin ⇒ 42501;
    - `p_from > p_to` ⇒ `Revisa las fechas`;
    - canal `'feria'` ⇒ `Canal desconocido`;
    - `dashboard_period('semana', now())` ⇒ `Período desconocido`.
  - **Límite:** con 3 ventas y `p_limit` 2 ⇒ 2 filas, `rowCount` 3 y los totales de las 3.
- [ ] **Step 2:** `npm run db:test` → FALLA (no existen las funciones).
- [ ] **Step 3:** escribir la migración. Para la fecha de venta de los pedidos web, una subconsulta lateral sobre `order_events`. `sales_totals` agrega sobre `sales_lines`.
- [ ] **Step 4:** `npm run db:test` → PASA todo, también los tests anteriores. Después, `npm run db:types` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(base): una sola definición de venta y lista de ventas`.

### Task 2: Ventas, ganancia y barras del período (base)

**Files:**
- Modify: `supabase/migrations/20261023000001_dashboard.sql`, `src/lib/supabase/database.types.ts`
- Create: `supabase/tests/dashboard.test.sql`

**Interfaces:**
- Consumes: `sales_lines`, `sales_totals` y `dashboard_period` (Tarea 1).
- Produces:
  - **`dashboard_buckets(p_period text, p_now timestamptz)`** (interna). Devuelve `table(idx int, kind text, b_from date, b_to date)` en días de La Paz, ambos inclusive:
    - `hoy` y `7dias`: 7 cubetas `dia`, de D−6 a D;
    - `mes`: cubetas `semana` de lunes a domingo, recortadas a [M, D];
    - `mes-anterior`: cubetas `semana` recortadas a ese mes completo;
    - `12meses`: 12 cubetas `mes`, de M−11 meses a M.
    
    `idx` empieza en 1.
  - **`admin_dashboard_sales(p_period text, p_now timestamptz default null) returns jsonb`**. Usa `now()` si `p_now` es nulo. Devuelve:
    ```
    { period, range: {from, to},                      -- list_from..list_to
      current: <sales_totals actual>, previous: <sales_totals anterior>,
      byChannel: {web, tienda, whatsapp},             -- salesCents de cada uno, período actual
      bars: [{idx, kind, from, to, salesCents, profitCents, withoutCostCents}],
      top: [{productId, name, units, revenueCents, profitCents, unitsWithoutCost, stock}],  -- hasta 20, por unidades y luego ingresos
      customers: {buyers, new, returning},
      ordersByStatus: {<status>: n} }                 -- pedidos con created_at en el período actual
    ```
    - **Clientes:** `customer_id` distintos de las líneas `web` del período. `new` = los que tienen su primera venta web de toda la historia dentro del período; `returning` = `buyers − new`.
    - **Más vendidos:** `top` trae hasta 20 productos. El selector Unidades / Ingresos de la pantalla reordena y corta a 10 **[mía, para no repetir la consulta]**.
    - **Barras:** las de hoy van hasta `now`, igual que el período actual.

- [ ] **Step 1: pgTAP que falla** `dashboard.test.sql`. Los `p_now` son fijos y las ventas se fechan como postgres.
  - **Períodos** (comparación de `dashboard_period` con valores exactos en `-04`):
    - `mes` con now `2026-10-21 10:00-04` ⇒ anterior [`2026-09-01 00:00-04`, `2026-09-21 10:00-04`);
    - `mes` con now `2027-03-31 12:00-04` ⇒ el anterior termina en `2027-03-01 00:00-04`;
    - `mes-anterior` con now `2027-01-15` ⇒ actual [`2026-12-01`, `2027-01-01`), anterior [`2026-11-01`, `2026-12-01`);
    - `hoy` a las 10:00 ⇒ anterior [ayer 00:00, ayer 10:00);
    - `12meses` en octubre de 2026 ⇒ `list_from` `2025-11-01`.
  - **Cubetas:**
    - `mes` con now `2026-10-21` ⇒ 4 cubetas: 1–4 (sáb–dom), 5–11, 12–18 y 19–21;
    - `mes-anterior` con now `2026-10-21` ⇒ 5 cubetas de septiembre: 1–7, 8–14, 15–21, 22–28 y 29–30;
    - `7dias` ⇒ 7 cubetas `dia`;
    - `12meses` ⇒ 12 cubetas `mes`.
  - **Igualdades del spec §5** (con las ventas de la Tarea 1 repartidas en 3 semanas de octubre):
    - Σ `bars.salesCents` = `current.salesCents`;
    - Σ `bars.profitCents` = `current.profitCents`;
    - Σ `byChannel` = `current.salesCents`;
    - `current` = `admin_sales_list(null, range.from, range.to)->'totals'`, el jsonb entero.
  - **Comparación:** una venta del 2026-09-20 entra en `previous` con now `2026-10-21 10:00`, y una del 2026-09-25 no.
  - **Medianoche:** una venta a las `2026-10-11 23:30-04` (domingo) cae en la cubeta 5–11 y no en la 12–18.
  - **Ganancia negativa:** una venta manual de A a 2000 (costo 3000) da una barra con `profitCents` −1000.
  - **Clientes:**
    - el cliente 1 compró en septiembre y vuelve en octubre ⇒ `returning` 1;
    - el cliente 2 compra por primera vez en octubre ⇒ `new` 1, `buyers` 2;
    - un pedido reembolsado del cliente 3 en octubre no lo cuenta.
  - **Más vendidos:** A queda primero con `units` 3 y `profitCents` 5000 − 1000; B tiene `unitsWithoutCost` 1.
  - **Ficha del producto:** con todas las ventas de A dentro del período, `top[A].profitCents` = `admin_product_cost_summary(A)->'sold'->>'profitCents'` (spec §5).
  - **Pedidos:** `ordersByStatus` cuenta uno `esperando_pago` creado en octubre y no uno creado en septiembre.
  - **Seguridad:** sin admin ⇒ 42501.
- [ ] **Step 2:** `npm run db:test` → FALLA.
- [ ] **Step 3:** agregar `dashboard_buckets` y `admin_dashboard_sales` a la misma migración. Cada barra = `sales_totals(b_from 00:00 La Paz, least(b_to + 1 día 00:00, cur_to))`.
- [ ] **Step 4:** `npm run db:test` → PASA. Después, `npm run db:types` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(base): ventas, ganancia, barras y clientes por período`.

### Task 3: Pendientes, se está agotando e inventario (base)

**Files:**
- Modify: `supabase/migrations/20261023000001_dashboard.sql`, `src/lib/supabase/database.types.ts`
- Create: `supabase/tests/dashboard_ahora.test.sql`

**Interfaces:**
- Consumes: `product_current_cost` (3B), `reserved_units_of` (3A), `purchase_balances` (3B) y `sales_lines` (Tarea 1).
- Produces: **`admin_dashboard_now() returns jsonb`**:
  ```
  { pendingReview, pendingReviewOver24h, toDeliver,          -- mismas reglas que admin_dashboard_summary
    purchasesToArrive,                                       -- compras 'encargada'
    debt: {bobCents, usdCents},                              -- Σ debt_cents > 0 de purchase_balances, por moneda
    runningLow: { items: [{productId, name, stock, sold30d,
                           reorder: {supplierName, contactName, whatsapp, quantity} | null}],   -- hasta 10
                  lowStockCount, outOfStockCount },
    inventory: { products, units, costValueCents, saleValueCents, potentialProfitCents,
                 withoutCost: {products, units, items: [{productId, name}]},   -- items hasta 20
                 withoutPrice: {products, items: [{productId, name}]},
                 samplesWithStock } }
  ```
  - **Se está agotando:** `runningLow.items` trae los productos con `is_active` y stock **disponible** (`products.stock`) entre 0 y 3. Se ordenan por `sold30d` desc (unidades de `sales_lines` en los últimos 30 días), luego por stock y luego por nombre.
    - `reorder` sale de la última compra recibida: proveedor, `contact_name`, `whatsapp` y `quantity_received`.
    - `lowStockCount` cuenta los visibles con stock 1–3, y `outOfStockCount` los visibles con stock 0, igual que los filtros `poco-stock` y `agotados` de Productos.
  - **Inventario:**
    - Unidades por producto = `stock + reserved_units_of(id)`. Cuentan los que tienen unidades > 0 y `not is_sample`, estén visibles u ocultos.
    - `costValueCents` = Σ unidades × costo vigente de los que tienen costo; `saleValueCents` = Σ unidades × precio de los que tienen `price_cents > 0`.
    - `potentialProfitCents` = Σ unidades × (precio − costo), solo de los que tienen las dos cosas.
    - `samplesWithStock` = productos `is_sample` con unidades > 0.

- [ ] **Step 1: pgTAP que falla** `dashboard_ahora.test.sql`. El test hace `delete` de las compras y pedidos de las semillas, y `update products set is_sample = true` en todos los existentes, para partir de cero.
  - **Productos:** P1 tiene stock 4, costo inicial 3000 y precio 5000. P2 tiene stock 2, sin costo, precio 4000. P3 está oculto, con stock 1, costo de compra y precio 0.
  - **Inventario:**
    - un pedido `pagado` que aparta 1 de P1 ⇒ P1 cuenta 4 + 1 = 5 unidades;
    - `costValueCents` = 5 × 3000 + 1 × costo de P3;
    - `saleValueCents` = 5 × 5000 + 2 × 4000;
    - `potentialProfitCents` = 5 × 2000;
    - `withoutCost.products` 1 (P2), `withoutPrice.products` 1 (P3);
    - `samplesWithStock` igual a la cantidad de productos de ejemplo con stock.
  - **Costo vigente:** el valor a costo usa el mismo que `admin_product_cost_summary(P1)->>'currentUnitCostCents'`.
  - **Se está agotando:**
    - P2 (stock 2, 3 vendidas en 10 días) sale antes que un P4 visible con stock 1 y 0 vendidas;
    - un P5 visible con stock 0 aparece;
    - P3, que está oculto, no aparece;
    - `reorder` de P3 es nulo porque no es visible; el de un producto con compra recibida trae `supplierName` y `quantity`.
  - **Deudas:** una compra BOB con deuda 5000 y una USD con deuda 1500 ⇒ `debt` {5000, 1500}. Una compra anulada no suma. `purchasesToArrive` cuenta las `encargada`.
  - **Pendientes:** `pendingReview` y `toDeliver` iguales a los de `admin_dashboard_summary()` con los mismos pedidos.
  - **Seguridad:** sin admin ⇒ 42501.
- [ ] **Step 2:** `npm run db:test` → FALLA.
- [ ] **Step 3:** agregar `admin_dashboard_now` a la migración.
- [ ] **Step 4:** `npm run db:test` → PASA. Después, `npm run db:types` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(base): pendientes, se está agotando e inventario valorizado`.

### Task 4: Períodos, comparación, barras y filtros (lógica de pantalla)

**Files:**
- Create: en `src/features/admin/dashboard/`, `period.ts`, `compare.ts`, `bars.ts`, `sales-filter.ts` (cada uno con su `.test.ts`) y `queries.ts`.

**Interfaces:**
- Consumes: las formas jsonb de las Tareas 1 a 3.
- Produces:
  - **`period.ts`:**
    - `type Period = "hoy" | "7dias" | "mes" | "mes-anterior" | "12meses"`;
    - `PERIODS: { value: Period; label: string }[]` (etiquetas de las Global Constraints);
    - `parsePeriod(v: string | string[] | undefined): Period`;
    - `profitTitle(p: Period, range: { from: string; to: string }): string`;
    - `previousLabel(p: Period, range): string`;
    - `barLabel(kind: "dia" | "semana" | "mes", from: string, idx: number): string`.
  - **`compare.ts`:** `compareLine(cur: SalesTotals, prev: SalesTotals, prevLabel: string): { tone: "up" | "down" | "same" | "neutral"; text: string }`.
  - **`bars.ts`:** `barScale(values: number[]): { pct: number; negative: boolean }[]`, con `pct` de 0 a 100 respecto del mayor valor absoluto.
  - **`sales-filter.ts`:**
    - `type Channel = "web" | "tienda" | "whatsapp"`;
    - `type SalesFilter = { period: Period | null; from: string | null; to: string | null; channel: Channel | null; withoutCost: boolean }`;
    - `parseSalesFilter(sp: Record<string, string | string[] | undefined>): SalesFilter`;
    - `salesHref(f: Partial<SalesFilter>): string`.
  - **`queries.ts`:**
    - tipos `SalesTotals`, `DashboardSales`, `DashboardNow` y `SalesList`, en camelCase como las Tareas 1 a 3;
    - `getDashboardSales(p: Period): Promise<DashboardSales>`, `getDashboardNow(): Promise<DashboardNow>` y `getSalesList(f: SalesFilter): Promise<SalesList>`, con `createServerSupabase()` y `throw error`, como en `src/features/admin/queries.ts`.

- [ ] **Step 1: Unitarias que fallan:**
  - **`parsePeriod`:** `parsePeriod(undefined)` y `parsePeriod("semana")` ⇒ `"mes"`; `parsePeriod(["hoy", "mes"])` ⇒ `"hoy"`.
  - **`profitTitle`:**
    - `("mes", {from: "2026-10-01", to: "2026-10-21"})` ⇒ `"Ganaste en octubre"`;
    - `("hoy", …)` ⇒ `"Ganaste hoy"`;
    - `("7dias", …)` ⇒ `"Ganaste en los últimos 7 días"`;
    - `("12meses", …)` ⇒ `"Ganaste en los últimos 12 meses"`;
    - `("mes-anterior", {from: "2026-09-01", to: "2026-09-30"})` ⇒ `"Ganaste en septiembre"`.
  - **`previousLabel`:**
    - `("mes", {from: "2026-10-01"…})` ⇒ `"septiembre"`;
    - `("mes", {from: "2027-01-01"…})` ⇒ `"diciembre"`;
    - `("hoy")` ⇒ `"ayer"`;
    - `("7dias")` ⇒ `"los 7 días anteriores"`;
    - `("12meses")` ⇒ `"los 12 meses anteriores"`.
  - **`barLabel`:** `("dia", "2026-10-20", 1)` ⇒ `"lun 20"`; `("semana", …, 2)` ⇒ `"sem 2"`; `("mes", "2026-10-01", 12)` ⇒ `"oct"`.
  - **`compareLine`:**
    - ganancia 180000 contra 145000, sin costos faltantes ⇒ `{tone: "up", text: "▲ Bs 350 más que septiembre"}`;
    - contra "ayer", con ganancia que baja Bs 120 ⇒ `"▼ Bs 120 menos que ayer"`;
    - con la misma ganancia ⇒ `"Igual que ayer"` y `tone` `same`;
    - con `withoutCostCents > 0` en cualquiera de los dos, ventas 520000 contra 440000 ⇒ `"▲ Vendiste Bs 800 más que septiembre · la ganancia no se compara porque faltan costos"`;
    - con `prev.count === 0` ⇒ `{tone: "neutral", text: "Sin ventas en septiembre para comparar"}`.
  - **`barScale`:**
    - `[0, 0, 0]` ⇒ todos `pct` 0, sin `NaN`;
    - `[100, 50, -50]` ⇒ `[100, 50, 50]` y `negative` solo en el tercero;
    - `[]` ⇒ `[]`.
  - **`parseSalesFilter`:**
    - `{periodo: "hoy", canal: "tienda", sincosto: "1"}` ⇒ `{period: "hoy", from: null, to: null, channel: "tienda", withoutCost: true}`;
    - `{desde: "2026-10-05", hasta: "2026-10-11"}` ⇒ fechas y `period: null`;
    - `{desde: "2026-13-40"}`, fechas al revés o `{}` ⇒ `{period: "mes", from: null, to: null, …}`;
    - `canal: "feria"` ⇒ `channel: null`.
  - **`salesHref`:** `salesHref({from: "2026-10-05", to: "2026-10-11", channel: "web"})` ⇒ `"/panel/ventas?desde=2026-10-05&hasta=2026-10-11&canal=web"`; `salesHref({period: "mes"})` ⇒ `"/panel/ventas?periodo=mes"`.
- [ ] **Step 2:** `npm test -- dashboard` → FALLA.
- [ ] **Step 3:** implementar.
  - Los nombres de mes y de día salen de un arreglo propio en español, no de `Intl`, para que no dependan del servidor.
  - Las fechas `YYYY-MM-DD` se leen como fecha civil, sin zona.
  - Los montos se escriben con `formatBs`.
- [ ] **Step 4:** `npm test` y `npm run typecheck` → PASA.
- [ ] **Step 5: Commit** `feat(panel): períodos, comparación, barras y filtros del dashboard`.

### Task 5: Página Ventas

**Files:**
- Create: `src/app/panel/ventas/page.tsx`, `src/features/admin/dashboard/SalesTable.tsx`, `src/features/admin/dashboard/PeriodTabs.tsx`
- Modify: `src/app/panel/mas/page.tsx` (primer enlace: `{ href: "/panel/ventas", label: "Ventas", hint: "Todo lo que vendiste, con su costo y ganancia", icon: ReceiptIcon }`), `e2e/portada-panel.spec.ts`

**Interfaces:**
- Consumes: `getSalesList`, `parseSalesFilter`, `salesHref` y `PERIODS` (Tarea 4).
- Produces: `PeriodTabs({ current: Period | null, hrefFor: (p: Period) => string })`, enlaces con `aria-current="page"` en el elegido, que la Tarea 6 reutiliza.

**Contenido de la página:**
- Título `Ventas` con el rango en palabras.
- `PeriodTabs`.
- Filtro de canal: `Todos · Web · Tienda · WhatsApp`, como enlaces.
- Casilla-enlace `Solo sin costo`.
- **Totales** en una `region` llamada `Totales`: `Vendiste`, `N ventas · M juegos`, `Te costaron`, `Ganancia`, `Sin costo anotado` y `Envíos cobrados`.
- **Tabla de filas:** fecha y hora de La Paz, canal, juego, cantidad, precio, costo o `sin costo` (resaltado), y ganancia.
  - Una fila web enlaza a `/panel/pedidos/<orderId>` con el texto `Pedido #<n>`; una fila manual enlaza a la ficha del producto.
  - En el celular, cada fila es una tarjeta; desde `sm`, una tabla. Siempre con `grid-cols-[minmax(0,1fr)]`, para evitar el desborde que ya pasó en 3B.
- Si `rowCount > rows.length`: `Mostrando las 200 más recientes de N. Los totales incluyen todas.`
- Sin ventas: `No hay ventas en este período.`
- La página va dentro de `<Suspense>`.

- [ ] **Step 1: e2e que falla** en `e2e/portada-panel.spec.ts`. Convertir el archivo a `test.describe.configure({ mode: "serial" })` y crear un `beforeAll` que limpie `orders` y `manual_sales` (como hoy). Los datos se crean con el cliente de servicio:
  - un producto con `product_costs` 3000 y precio 5000;
  - dos ventas manuales de hoy (una en tienda y otra por WhatsApp);
  - un pedido web pagado de otro producto sin costo.
  
  La prueba `la lista de ventas cuadra con sus totales`:
  - en `/panel/ventas?periodo=hoy`, la región `Totales` muestra la suma esperada en Bs, `3 ventas` y la ganancia esperada;
  - la fila sin costo muestra `sin costo`;
  - el enlace `Tienda` deja 1 fila y su total;
  - `Solo sin costo` deja solo la fila web;
  - `Pedido #` lleva al detalle del pedido;
  - desde `/panel/mas`, el enlace `Ventas` llega a la página.
- [ ] **Step 2:** `npx playwright test e2e/portada-panel.spec.ts --project=portada` → FALLA.
- [ ] **Step 3:** implementar la página, `SalesTable`, `PeriodTabs` y el enlace en Más.
- [ ] **Step 4:** el mismo comando → PASA. También `npm run lint` y `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(panel): página Ventas con totales que cuadran`.

### Task 6: Portada nueva (dashboard) y cierre

**Files:**
- Create: en `src/features/admin/dashboard/`, `ProfitHero.tsx`, `ProfitBars.tsx`, `PendingCards.tsx`, `RestockSection.tsx`, `TopProducts.tsx` (`"use client"`, solo el selector), `InventoryCard.tsx` y `CustomersOrders.tsx`.
- Modify: `src/app/panel/page.tsx`, `src/features/admin/queries.ts` (quitar `DashboardSummary` y `getDashboardSummary`), `e2e/portada-panel.spec.ts`, `docs/PROYECTO.md`, `docs/contexto/repomix-proyecto.xml`
- Delete: `src/features/admin/SummaryCards.tsx`

**Interfaces:**
- Consumes: todo lo de las Tareas 4 y 5, además de `reorderMessage` (`src/features/admin/purchases/reorder.ts`) y `buildWhatsAppLink` (`src/lib/whatsapp.ts`) para «Pedir de nuevo».

**Portada (`/panel?periodo=…`)**, de arriba abajo en el celular:
1. Los atajos `Nuevo producto` y `Vendí en tienda` (igual que hoy) y `PeriodTabs` (`hrefFor` = `/panel?periodo=<p>`).
2. **`ProfitHero`**, `section` con nombre `Ganancia`:
   - el título (`profitTitle`) y la ganancia en grande, como enlace a `salesHref({period})`;
   - `compareLine`;
   - `ProfitBars`, donde cada barra es un enlace a `salesHref({from, to})` con `aria-label` `"<barLabel>: Bs X de ganancia"`; el monto va encima, la etiqueta debajo, y la barra actual (la última) va resaltada; las negativas van hacia abajo en rojo;
   - `Vendiste Bs X (N ventas, M juegos) · te costaron Bs Y`;
   - los canales `Web · Tienda · WhatsApp`, cada uno como enlace con `channel`;
   - `Envíos cobrados: Bs Z`;
   - el aviso de sin costo, que enlaza a `withoutCost: true`.
3. **`PendingCards`**, sección `Pendiente`:
   - `Por revisar` (rojo si hay más de 24 h) → `/panel/pedidos`;
   - `Por entregar` → `/panel/pedidos?tab=entregar`;
   - `Compras por llegar` → `/panel/compras`;
   - `Debes a proveedores` → `/panel/compras`, con `Bs` y `US$` en líneas separadas y en rojo si alguno es mayor que 0.
4. **`RestockSection`**, sección `Qué volver a comprar`:
   - `TopProducts`, con el selector `Unidades · Ingresos` (botones con `aria-pressed`) y 10 filas que enlazan a `/panel/productos/<id>`;
   - `Se está agotando`, con stock, `sold30d` y `Pedir de nuevo` (enlace de WhatsApp si `reorder.whatsapp`);
   - `Ver poco stock (n)` → `?filtro=poco-stock` y `Ver agotados (n)` → `?filtro=agotados`.
5. **`InventoryCard`**, sección `Inventario`:
   - juegos y unidades, `Valor a costo`, `Valor a precio de venta` y `Si vendes todo, ganarías`;
   - `<details>` con los juegos sin costo y sin precio, enlazados a su ficha;
   - el texto de muestras si `samplesWithStock > 0`.
6. **`CustomersOrders`**, secciones `Clientes` (con `Compraron`, `Nuevos`, `Volvieron a comprar` y el texto `Solo cuenta la tienda web`) y `Pedidos`, una franja por estado con `ADMIN_STATUS_LABEL` que enlaza a `/panel/pedidos?tab=historial&estado=<status>`.

**Diseño:**
- En la PC (`lg`), dos columnas: la izquierda con 2 y 3, y la derecha con 4, 5 y 6.
- `Promise.all([getDashboardSales(p), getDashboardNow()])` dentro de `<Suspense>`, con el mismo esqueleto pulsante de hoy.
- Paleta y tarjetas del panel actual: `rounded-3xl border-[#eadcc4] bg-papel`, `verde` y `rojo`.

- [ ] **Step 1: e2e que falla** en `e2e/portada-panel.spec.ts`. Reemplaza la prueba vieja de la portada; se mantiene la del manifest.
  - **`la portada muestra la ganancia y lleva a la lista que la forma`** (mismos datos que la Tarea 5):
    - en `/panel?periodo=hoy`, la sección `Ganancia` muestra la ganancia esperada y el aviso `en ventas sin costo anotado`;
    - tocar la ganancia lleva a `/panel/ventas?periodo=hoy`, y la región `Totales` muestra la misma `Ganancia`;
    - volver y tocar la última barra lleva a la lista del día, con el mismo total.
  - **`la portada muestra lo pendiente y qué volver a comprar`:**
    - con un pedido `en_revision`, una compra `encargada` con deuda (`createRawPurchase`) y Jenga con stock 2 (semilla):
      - `Por revisar` muestra 1;
      - `Compras por llegar` muestra 1;
      - `Debes a proveedores` muestra `Bs`;
      - `Se está agotando` contiene Jenga.
    - Unidades / Ingresos cambia el orden de `Lo más vendido` (dos productos: uno con más unidades y otro con más ingresos).
  - **`sin ventas la portada no se rompe`:** con `?periodo=mes-anterior` y la base sin ventas, se ve `Bs 0`, la comparación neutra y ninguna barra con `NaN` en el estilo.
  - **`en la PC la portada usa dos columnas`:** con `page.setViewportSize({ width: 1280, height: 800 })`, la caja de `Inventario` empieza a la derecha del borde derecho de `Ganancia`.
  - **`en el celular no hay desborde horizontal`:** `document.documentElement.scrollWidth <= 360`.
- [ ] **Step 2:** `npx playwright test e2e/portada-panel.spec.ts --project=portada` → FALLA.
- [ ] **Step 3:** implementar los componentes, reemplazar `src/app/panel/page.tsx` y borrar `SummaryCards.tsx`, `getDashboardSummary` y `DashboardSummary`.
  - `admin_dashboard_summary` **se queda** en la base: las pruebas de las Tareas 1 y 3 lo usan como testigo de que los números no cambiaron.
- [ ] **Step 4:** la suite completa: `npm test`, `npm run test:int`, `npm run db:test`, `npm run lint`, `npm run typecheck` y `npm run test:e2e` → todo PASA.
- [ ] **Step 5: Docs.** En `docs/PROYECTO.md`:
  - estado: Plan 5 en la rama y la migración `20261023000001`;
  - modelo: `sales_lines` como la única definición de venta.
  
  Después, `npx repomix` para regenerar `docs/contexto/repomix-proyecto.xml`.
- [ ] **Step 6: Commit** `feat(panel): portada con ganancia, pendientes, inventario y clientes`.

**Después de la Tarea 6:** Diego hace `npx supabase db push` en la nube (una migración nueva) y prueba la vista previa del PR en su Android y en la PC antes de fusionar.
