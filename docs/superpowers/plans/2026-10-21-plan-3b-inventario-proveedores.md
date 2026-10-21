# Plan 3B — Inventario, proveedores y compras

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El dueño registra proveedores y compras, desde el encargo y el adelanto hasta la llegada por bus y el pago del saldo, en Bs o en dólares. El stock sube al llegar. El panel muestra lo que debe a cada proveedor, lo que falta llegar y el costo real, el margen y la ganancia de cada juego, con números que cuadran al centavo con lo que pagó.

**Architecture:**
- Todo lo de compras vive en tablas solo de admin (`suppliers`, `purchases`, `purchase_items`, `purchase_payments`, `product_costs`, `sale_costs`), con RLS de lectura para admin.
- Las escrituras de compras pasan por funciones RPC `security definer` con `require_admin()`. Los proveedores son una tabla simple, que se edita con RLS de admin como los ajustes.
- `recompute_purchase_costs(purchase_id)` recalcula el costo real de cada línea (valor en Bs + parte del envío, repartida por el resto mayor) cada vez que cambia la llegada o los pagos.
- La vista `purchase_balances` (`security_invoker`) calcula total, pagado y deuda de cada compra en su moneda.
- Un trigger copia el costo vigente en `sale_costs` al confirmar el pago de un pedido y al registrar una venta manual.

**Tech Stack:** el del proyecto (Next 16 + Cache Components, Supabase, Tailwind + shadcn, zod, Vitest, Playwright, pgTAP).

**Spec:** `docs/superpowers/specs/2026-10-21-inventario-proveedores-design.md`, que amplía el §5.7 de `docs/superpowers/specs/2026-10-19-panel-dueno-design.md`. Contexto: `docs/PROYECTO.md`.

## Global Constraints

- Todas las reglas de `CLAUDE.md`: Node 22, Next 16 con `<Suspense>`, la base como fuente de verdad, RLS en toda tabla nueva, TDD, mensajes en español.
- **Los costos nunca van en `products` ni en `order_items`**: las dos tablas son legibles por el público o por el comprador.
- Funciones admin: `perform public.require_admin()` (42501); los errores para la persona usan `P0001`; `execute` revocado de `public, anon`.
- **Dinero en enteros:** centavos de Bs, o centavos de US$ en compras y pagos en dólares. El dólar va en `numeric(10,4)`. Cada conversión se redondea **una sola vez** al centavo, al guardarse.
- **Igualdades del spec §5** (cada una con prueba):
  - total de compra = Σ cantidad efectiva × precio;
  - deuda = total − Σ pagos vigentes convertidos;
  - Σ partes del envío = envío;
  - Σ costo de líneas = valor en Bs + envío;
  - Σ `stock_movements` = stock.
- **Estados de compra (exactos):** `encargada`, `recibida`, `anulada`. **Monedas (exactas):** `BOB` y `USD`.
- **Motivos de stock:** la llegada y sus correcciones usan `compra`; la anulación de una compra recibida usa el motivo nuevo `anulacion_compra`.
- **Producto creado desde una compra:** `is_active = false`, `price_cents = 0`, `stock = 0`. **Nunca visible con precio 0**, porque lo prohíbe una restricción de la base.
- Toda Server Action que cambie stock o visibilidad llama a `invalidateCatalog()`. Las acciones del panel usan `callAction` y los borrados o anulaciones usan `ConfirmButton`.
- **Mensajes exactos:**
  - Llegada repetida: `Esta compra ya llegó`.
  - Editar algo que no está encargado: `Solo se puede corregir una compra encargada`.
  - Corregir algo que no llegó: `Solo se puede corregir la llegada de una compra recibida`.
  - Anular con pagos: `Primero anula los pagos de esta compra`.
  - Anular o bajar algo ya vendido: `No alcanza el stock: ya se vendieron N de «<producto>»`.
  - Falta el dólar: `Anota a cuánto estaba el dólar`.
  - Saldo a otro proveedor: `Solo se puede usar el saldo en una compra del mismo proveedor`.
  - Compra sin saldo a favor: `Esta compra no tiene saldo a favor`.
  - Mostrar un producto con precio 0: `Pon un precio de venta antes de mostrar el producto`.
- Rama `feat/plan-3b-proveedores`, PR a `main` y una sola fusión con el visto bueno de Diego.

## Review Focus

1. **Doble toque o respuesta perdida en "Nueva compra", "Llegó" o un pago:** no duplica la compra, el stock ni el pago, gracias a `request_id` y al estado esperado → pgTAP Tareas 1 y 2.
2. **Compra en dólares con el adelanto en US$ y el saldo en Bs, cada uno a otro precio del dólar:** la deuda en US$ queda exacta y, al quedar pagada, el costo en Bs es exactamente lo que salió del bolsillo → pgTAP Tarea 2, con números fijos.
3. **Corregir la llegada o anular cuando ya se vendió parte:** error claro, sin tocar el stock ni los costos → pgTAP Tarea 1.
4. **Juego nuevo encargado:** no aparece en la tienda ni en la búsqueda, ni siquiera después de llegar, hasta que el dueño le pone precio y lo muestra → e2e Tarea 6.
5. **Un comprador (no admin) leyendo compras, pagos, costos o `sale_costs`:** 0 filas o 42501 → pgTAP Tareas 1 a 3.

---

## Estructura de archivos

```
supabase/migrations/20261022000001_compras.sql        # proveedores, compras, líneas, pagos, vista de saldos, RPC de compras
supabase/migrations/20261022000002_costos.sql         # costo inicial, costo vigente, sale_costs (triggers), resumen por producto
supabase/tests/compras.test.sql · compras_pagos.test.sql · costos.test.sql
src/features/admin/purchases/
  money.ts (+ test)            # parseRate, formatMoney(cents, currency), centsFromText
  purchase-schema.ts (+ test)  # zod de líneas, compra, llegada y pago
  reorder.ts (+ test)          # mensaje "Pedir de nuevo por WhatsApp"
  purchase-actions.ts · supplier-actions.ts · queries.ts
  PurchaseForm.tsx · ArrivalDialog.tsx · PaymentDialog.tsx · CreditActions.tsx · PurchaseList.tsx · DebtsCard.tsx
  SupplierForm.tsx · CostPanel.tsx
src/app/panel/compras/page.tsx · compras/nueva/page.tsx · compras/[id]/page.tsx
src/app/panel/proveedores/page.tsx · proveedores/[id]/page.tsx
e2e/panel-proveedores.spec.ts · e2e/panel-compras.spec.ts · e2e/panel-costos.spec.ts
```

---

### Task 1: Proveedores, compras, llegada y anulación (base)

**Files:**
- Create: `supabase/migrations/20261022000001_compras.sql`, `supabase/tests/compras.test.sql`
- Modify: `src/lib/supabase/database.types.ts` (regenerar)

**Interfaces:**
- Produces:
  - **Proveedores:** `suppliers(id uuid pk, name text not null, contact_name text, whatsapp text, notes text, is_active bool default true, created_at)`. RLS: admin lee y gestiona.
  - **Compras:** `purchases(id uuid pk, request_id uuid unique not null, supplier_id uuid → suppliers, ordered_on date not null default current_date, currency text check in ('BOB','USD'), arrival_rate numeric(10,4), shipping_cents int check ≥ 0, status text check in ('encargada','recibida','anulada') default 'encargada', note text, issues_note text, received_at timestamptz, voided_at timestamptz, created_by uuid, created_at)`.
  - **Líneas:** `purchase_items(id uuid pk, purchase_id → purchases on delete cascade, product_id → products, quantity_ordered int check > 0, quantity_received int check ≥ 0, unit_price_cents int check ≥ 0, line_cost_cents bigint)`. `line_cost_cents` es el costo real en centavos de Bs, con el envío; queda nulo hasta la llegada.
  - **Pagos:** `purchase_payments(id uuid pk, request_id uuid unique, purchase_id → purchases, paid_on date default current_date, currency text check in ('BOB','USD'), amount_cents int not null, rate numeric(10,4), amount_purchase_cents int not null, amount_bob_cents bigint not null, kind text check in ('pago','devolucion','saldo_usado','saldo_recibido'), linked_payment_id uuid, note text, voided_at timestamptz, created_by uuid, created_at)`. La tabla se crea aquí y se usa en la Tarea 2.
  - **RLS** en las cuatro tablas: solo admin lee; en `purchases`, `purchase_items` y `purchase_payments` se revocan insert, update y delete para `authenticated`.
  - **Vista de saldos:** `purchase_balances` (`with (security_invoker = true)`), con `id, supplier_id, currency, status, total_cents, paid_cents, debt_cents`.
    - `total_cents` = Σ `coalesce(quantity_received, quantity_ordered)` × precio cuando la compra está `encargada`, y Σ `quantity_received` × precio cuando está `recibida`.
    - `paid_cents` = Σ `amount_purchase_cents` de los pagos no anulados.
    - `debt_cents` = total − pagado.
    - Las compras anuladas no aparecen.
  - **Stock y precio:** se amplía el check de `stock_movements.reason` con `anulacion_compra`, y `products` lleva `constraint products_visible_price check (not is_active or price_cents > 0)`.
  - **`admin_create_purchase(p_request_id uuid, p_supplier_id uuid, p_ordered_on date, p_currency text, p_note text, p_lines jsonb) returns uuid`.**
    - Es idempotente por `request_id`.
    - Cada línea es `{product_id}` o `{new_product: {name, category_id}}`, más `{quantity, unit_price_cents}`.
    - Un `new_product` se crea oculto, con precio 0 y stock 0. Su slug sale de `public.slugify_name(text)` (SQL, con `immutable_unaccent`) más un sufijo `-2`, `-3`… si ya existe, como `nextFreeSlug`.
    - Valida que haya al menos 1 línea y como máximo 50.
  - **`admin_update_purchase(p_purchase_id, p_supplier_id, p_ordered_on, p_currency, p_note, p_lines) returns void`.** Solo con la compra `encargada`; reemplaza las líneas (puede crear productos nuevos).
  - **`admin_set_purchase_notes(p_purchase_id, p_note, p_issues_note) returns void`.** Funciona en cualquier estado.
  - **`admin_receive_purchase(p_purchase_id uuid, p_received jsonb, p_shipping_cents int, p_arrival_rate numeric) returns void`.**
    - `p_received` es `[{item_id, quantity}]`.
    - Bloquea la compra. Si no está `encargada`, devuelve `Esta compra ya llegó`.
    - En una compra en USD, si falta el dólar, devuelve `Anota a cuánto estaba el dólar`.
    - Pone `quantity_received` en cada línea, sube el stock con `set_stock_reason('compra', purchase_id)`, pasa la compra a `recibida` con `received_at = now()` y llama a `recompute_purchase_costs`.
  - **`admin_correct_arrival(p_purchase_id, p_received, p_shipping_cents, p_arrival_rate) returns void`.**
    - Solo con la compra `recibida`; si no, `Solo se puede corregir la llegada de una compra recibida`.
    - Ajusta el stock con la diferencia (motivo `compra`). Si una baja deja el stock negativo, devuelve `No alcanza el stock: ya se vendieron N de «X»`.
    - Termina con `recompute_purchase_costs`.
  - **`admin_void_purchase(p_purchase_id) returns void`.**
    - Con pagos no anulados devuelve `Primero anula los pagos de esta compra`.
    - Si está `recibida`, resta el stock con `anulacion_compra`, con el mismo error si no alcanza.
    - Pasa la compra a `anulada` y llena `voided_at`.
  - **`recompute_purchase_costs(p_purchase_id) returns void`** (interna; `execute` revocado a todos).
    - **Valor en Bs de cada línea recibida:**
      - en BOB es `quantity_received × unit_price_cents`;
      - en USD es el total en USD × el dólar efectivo, redondeado una vez y repartido por el resto mayor según el valor en USD de cada línea.
      
      En esta tarea, el dólar efectivo es `arrival_rate`; la Tarea 2 suma los pagos.
    - **Envío:** se reparte entre las líneas según su valor en Bs, por el resto mayor. A igual resto, gana el `id` menor.
    - **Resultado:** `line_cost_cents` = valor en Bs + parte del envío; queda 0 si llegaron 0 unidades.

    El algoritmo del resto mayor:
    ```
    partes_i = floor(total × peso_i / Σpesos); sobra = total − Σpartes_i
    sumar 1 a las `sobra` líneas con mayor (total × peso_i mod Σpesos), desempate por id
    ```

- [ ] **Step 1: pgTAP que falla** `compras.test.sql`, con admin, cliente, categoría, 2 productos propios y un proveedor:
  - **crear una compra BOB:** líneas A 2 × 10000 y B 1 × 5000 ⇒ `encargada`, `total_cents` 25000, stock sin cambiar;
  - **la misma `request_id`** ⇒ devuelve el mismo id y no hay una segunda compra;
  - **un producto nuevo** `{new_product: {name: 'Juego encargado', category_id}}` ⇒ existe, con `is_active = false`, precio 0 y stock 0;
  - **mostrarlo sin precio** (`update products set is_active = true` como postgres) ⇒ viola `products_visible_price`;
  - **recibir con A 2, B 1 y envío 1000** ⇒ stock +2 y +1 con movimientos `compra` y `ref_id` = compra, y `line_cost_cents` A 20800 y B 5200;
  - **recibir otra vez** ⇒ `Esta compra ya llegó`;
  - **reparto por el resto mayor:** 3 líneas de 1 × 100 con envío 100 ⇒ partes {33, 33, 34} y Σ `line_cost_cents` = 400;
  - **corregir la llegada:** con 5 de A recibidas y 4 vendidas (`admin_record_manual_sale`), bajar A a 0 ⇒ `No alcanza el stock: ya se vendieron 4 de «A»` y el stock no cambia; bajar a 1 ⇒ funciona y el stock baja 4;
  - **editar una compra recibida** ⇒ `Solo se puede corregir una compra encargada`;
  - **anular una compra recibida** de la que no se vendió nada ⇒ el stock vuelve, hay un movimiento `anulacion_compra` y la compra queda `anulada`, fuera de `purchase_balances`;
  - **compra USD** de 10 × US$10, recibida con `arrival_rate` 6.96 y sin dólar ⇒ `Anota a cuánto estaba el dólar`; con 6.96 ⇒ `line_cost_cents` 69600;
  - **la suma de los movimientos** de cada producto de la prueba = su stock;
  - **como cliente:** `select` de las cuatro tablas y de la vista ⇒ 0 filas, y cada RPC ⇒ 42501.
- [ ] **Step 2: Correr** `npx supabase db reset && npm run db:test` → FAIL.
- [ ] **Step 3: Implementar** la migración.
- [ ] **Step 4: Correr** → PASS (todas las suites). Después, `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): proveedores y compras con llegada, corrección y anulación`.

---

### Task 2: Pagos, dólar efectivo y saldo a favor

**Files:**
- Create: `supabase/tests/compras_pagos.test.sql`
- Modify: `supabase/migrations/20261022000001_compras.sql` (todavía no está publicada), `src/lib/supabase/database.types.ts`

**Interfaces:**
- Consumes: las tablas y `recompute_purchase_costs` de la Tarea 1.
- Produces:
  - **`admin_record_payment(p_request_id uuid, p_purchase_id uuid, p_paid_on date, p_currency text, p_amount_cents int, p_rate numeric, p_note text, p_kind text default 'pago') returns uuid`.**
    - Es idempotente por `request_id`.
    - `p_kind` es `pago` o `devolucion`; la devolución se guarda negativa.
    - Pide el dólar (`Anota a cuánto estaba el dólar`) si el pago o la compra es en USD.
    - **`amount_purchase_cents`:** si la moneda coincide, es el mismo monto; un pago en BOB sobre una compra en USD es `round(amount / rate)`; uno en USD sobre una compra en BOB es `round(amount × rate)`.
    - **`amount_bob_cents`:** en BOB es el monto; en USD es `round(amount × rate)`.
    - Se puede pagar en cualquier estado salvo `anulada`. Si la compra está `recibida`, llama a `recompute_purchase_costs`.
  - **`admin_void_payment(p_payment_id) returns void`.** Llena `voided_at`. Si el pago es parte de un traspaso de saldo, anula también el otro lado. Después recalcula.
  - **`admin_apply_credit(p_request_id uuid, p_from_purchase_id uuid, p_to_purchase_id uuid, p_rate numeric) returns void`.**
    - Las dos compras deben ser del mismo proveedor; si no, `Solo se puede usar el saldo en una compra del mismo proveedor`.
    - El saldo es `−debt_cents` de la compra de origen; si no es positivo, `Esta compra no tiene saldo a favor`.
    - Inserta en el origen un `saldo_usado` (negativo) y en el destino un `saldo_recibido` (positivo, convertido con `p_rate` si las monedas difieren). Los dos quedan enlazados por `linked_payment_id` y tienen el mismo `amount_bob_cents` con signo opuesto.
  - **Dólar efectivo en `recompute_purchase_costs`** (solo USD):
    - `pagadoUSD` = Σ `amount_purchase_cents` y `pagadoBs` = Σ `amount_bob_cents` de los pagos vigentes.
    - Si `pagadoUSD ≥ totalUSD`, el dólar efectivo es `pagadoBs / pagadoUSD`.
    - Si no, es `(pagadoBs + (totalUSD − pagadoUSD) × arrival_rate) / totalUSD`.
    - El valor de los productos en Bs es `round(totalUSD × efectivo)` y se reparte como en la Tarea 1.

- [ ] **Step 1: pgTAP que falla** `compras_pagos.test.sql`:
  - **compra USD** de 10 × US$10 (totalUSD 10000), recibida a 7.00 y con un adelanto de US$40 a 6.96 (`amount_bob_cents` 27840):
    - deuda = 6000;
    - costo de los productos = 27840 + 6000 × 7.00 = 69840.
  - **saldo pagado** con Bs 426,00 a 7.10 (= 6000 centavos de US$; `amount_bob_cents` 42600):
    - deuda = 0;
    - Σ `line_cost_cents` = 27840 + 42600 = **70440** (lo que salió del bolsillo, sin envío).
  - **la misma `request_id`** del pago ⇒ un solo pago.
  - **compra BOB** de 1000 con un pago de 1200 ⇒ deuda −200 (saldo a favor).
    - Aplicado a otra compra BOB del mismo proveedor, con deuda 500 ⇒ origen 0 y destino 300.
    - Aplicado a la compra de otro proveedor ⇒ el mensaje exacto.
    - Anular el `saldo_recibido` ⇒ se anulan los dos y el origen vuelve a −200.
  - **"El proveedor me devolvió"** (`devolucion`, 200) sobre una compra con saldo −200 ⇒ deuda 0.
  - **anular una compra con pagos** ⇒ `Primero anula los pagos de esta compra`.
  - **deuda por proveedor:** Σ `debt_cents > 0` de `purchase_balances` agrupado por moneda = lo esperado.
  - **como cliente:** cada RPC ⇒ 42501.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS; `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): pagos en Bs o dólares, dólar efectivo y saldo a favor`.

---

### Task 3: Costo vigente, copia en cada venta y resumen por producto

**Files:**
- Create: `supabase/migrations/20261022000002_costos.sql`, `supabase/tests/costos.test.sql`

**Interfaces:**
- Consumes: `purchase_items.line_cost_cents` (Tareas 1 y 2) y `manual_sales` / `order_items` de los planes anteriores.
- Produces:
  - **Costo de lo que ya tenías:** `product_costs(product_id uuid pk → products on delete cascade, initial_cost_cents int check ≥ 0, updated_at)`. Admin lee; solo se escribe por RPC.
  - **Copia del costo en cada venta:** `sale_costs(id bigint identity pk, source text check in ('web','manual'), order_item_id uuid unique → order_items on delete cascade, manual_sale_id uuid unique → manual_sales on delete cascade, product_id uuid, quantity int, unit_price_cents int, unit_cost_cents int, cost_origin text check in ('compra','inicial'), created_at)`. Admin lee.
  - **`product_current_cost(p_product_id) returns table(unit_cost_cents int, origin text)`.**
    - Usa la última línea de una compra `recibida` con `quantity_received > 0`, por `received_at desc`: `round(line_cost_cents / quantity_received)` con origen `compra`.
    - Si no hay, usa `initial_cost_cents` con origen `inicial`. Si tampoco hay, devuelve nulos.
  - **Triggers que copian el costo:**
    - un `order_events` con `to_status = 'pagado'` inserta una fila `web` por cada `order_item` (`on conflict do nothing`);
    - un `insert` en `manual_sales` inserta su fila `manual`.
  - **`admin_set_initial_cost(p_product_id uuid, p_cost_cents int) returns void`.** Con `null` borra el costo.
  - **`admin_product_cost_summary(p_product_id) returns jsonb`**, con:
    - `currentUnitCostCents` y `costOrigin`;
    - `averageUnitCostCents`: Σ `line_cost` / Σ cantidad de las compras recibidas;
    - `initialCostCents`;
    - `lastPurchase`: `{purchaseId, supplierId, supplierName, supplierWhatsapp, receivedAt, quantity, unitCostCents}`;
    - `purchases`: las 20 últimas, como `[{purchaseId, supplierName, receivedAt, quantity, unitCostCents, status}]`;
    - `sold`: `{units, unitsWithoutCost, revenueCents, profitCents}`.
    
    En `sold` solo cuentan:
    - las ventas web de pedidos `pagado`, `enviado`, `listo_para_recoger` o `entregado`;
    - las ventas manuales no anuladas.
    
    La ganancia es Σ (precio − costo) × cantidad, solo en las filas que tienen costo.

- [ ] **Step 1: pgTAP que falla** `costos.test.sql`:
  - **sin compras ni costo inicial** ⇒ costo nulo; una venta manual de 1 ⇒ `sale_costs` con costo nulo y `unitsWithoutCost` = 1;
  - **costo inicial 3000** ⇒ costo 3000 / `inicial`; venta manual a 5000 ⇒ ganancia 2000;
  - **compra recibida** con línea 2 × 4000 y envío 200 (`line_cost` 8200) ⇒ costo 4100 / `compra`; una venta web confirmada (`en_revision → pagado`) a 6000 ⇒ ganancia +1900;
  - **una compra posterior** más cara no cambia las ganancias ya registradas;
  - **pedido reembolsado** ⇒ su venta no cuenta en `sold`;
  - **venta manual anulada** ⇒ no cuenta;
  - **como cliente:** `select` de `sale_costs` y `product_costs` ⇒ 0 filas, y las RPC ⇒ 42501.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS; `npm run db:types`.
- [ ] **Step 5: Commit** `feat(db): costo vigente, copia del costo en cada venta y ganancia por producto`.

---

### Task 4: Dinero, formularios y mensaje de WhatsApp (TS puro)

**Files:**
- Create: `src/features/admin/purchases/money.ts`, `purchase-schema.ts`, `reorder.ts` y un `*.test.ts` para cada uno.

**Interfaces:**
- Consumes: `bsTextToCents` / `centsToBsText` (`product-schema.ts`) y `formatBs` (`src/lib/money.ts`).
- Produces:
  - `parseRate(text: string): number | null`.
    - Acepta `6,96`, `6.96` y `7`.
    - Rechaza ≤ 0, más de 4 decimales y valores ≥ 100.
  - `formatMoney(cents: number, currency: "BOB" | "USD"): string`.
    - `BOB` usa `formatBs`.
    - `USD` da `US$ 1.234,50`, con el mismo separador de miles.
  - `moneyToCents(text: string): number | null`. Es un alias de `bsTextToCents` y sirve para cualquier moneda.
  - `purchaseInputSchema` (zod, recibe texto del formulario):
    - campos `{supplierId, orderedOn, currency, note, lines: [{productId?, newProduct?: {name, categoryId}, quantity, unitPrice}]}`;
    - cada línea tiene un `productId` o un `newProduct`;
    - la cantidad va de 1 a 10000;
    - el precio debe ser ≥ 0;
    - de 1 a 50 líneas;
    - el resultado sale en centavos.
  - `arrivalInputSchema`: `{received: [{itemId, quantity}], shipping, rate?}`. Exige `rate` si la compra es en USD.
  - `paymentInputSchema`: `{paidOn, currency, amount, rate?, note, kind}`. Exige `rate` si el pago o la compra son en USD.
  - `reorderMessage({ supplierContact, supplierName, productName, quantity }): string` devuelve exactamente:
    ```
    Hola <contacto o proveedor>, ¿me puedes enviar de nuevo <cantidad> × <producto>? Gracias.
    ```
    La cantidad sugerida es la de la última compra **[constructor según el spec §7]**.
- [ ] **Step 1: Pruebas que fallan:**
  - `parseRate`: `"6,96"` → 6.96, `"0"` → null, `"6,96123"` → null;
  - `formatMoney(123450, "USD")` → `"US$ 1.234,50"`;
  - el esquema rechaza una línea sin producto, con el mensaje `Elige un producto o escribe uno nuevo`;
  - una compra en USD sin dólar en la llegada da `Anota a cuánto estaba el dólar`;
  - `reorderMessage` da el texto exacto.
- [ ] **Step 2: Correr** `npx vitest run src/features/admin/purchases` → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS.
- [ ] **Step 5: Commit** `feat(compras): dinero, dólar, formularios y mensaje para volver a pedir`.

---

### Task 5: Proveedores en el panel

**Files:**
- Create: `src/features/admin/purchases/supplier-actions.ts`, `SupplierForm.tsx`, `src/app/panel/proveedores/page.tsx`, `src/app/panel/proveedores/[id]/page.tsx`, `e2e/panel-proveedores.spec.ts`
- Modify: `src/app/panel/mas/page.tsx` (enlaces "Compras" y "Proveedores"), `src/features/admin/purchases/queries.ts` (`listSuppliers()` y `getSupplier(id)` con su deuda por moneda y sus compras)

**Interfaces:**
- Produces:
  - `saveSupplierAction(input)` y `deleteSupplierAction(id)`. Borrar un proveedor con compras lo desactiva (23503 ⇒ `is_active = false`) y avisa `Se desactivó porque tiene compras`.
  - En la lista: nombre, contacto, **lo que se le debe** (`formatMoney` por moneda) y el filtro "Activos".
  - En la ficha: el formulario, **"Escribir por WhatsApp"** (`buildWhatsAppLink`), sus compras y la nota.
- [ ] **Step 1: e2e que falla:**
  - crear "Distribuidora Andina" con WhatsApp `71234567` ⇒ aparece en la lista;
  - el enlace de WhatsApp de la ficha empieza con `https://wa.me/59171234567`;
  - borrar un proveedor sin compras ⇒ desaparece;
  - con una compra creada por `adminClient` ⇒ borrar avisa `Se desactivó porque tiene compras`.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): proveedores`.

---

### Task 6: Compras en el panel

**Files:**
- Create: `src/features/admin/purchases/purchase-actions.ts`, `PurchaseForm.tsx`, `ArrivalDialog.tsx`, `PaymentDialog.tsx`, `CreditActions.tsx`, `PurchaseList.tsx`, `DebtsCard.tsx`, `src/app/panel/compras/page.tsx`, `compras/nueva/page.tsx`, `compras/[id]/page.tsx`, `e2e/panel-compras.spec.ts`
- Modify: `src/features/admin/purchases/queries.ts`, con:
  - `getPurchasesOverview()`, que devuelve:
    - `debts`: `[{supplierId, name, BOB, USD}]`;
    - `totals`;
    - `pending`: `[{id, supplierName, orderedOn, daysWaiting, currency, totalCents}]`;
  - `listPurchases({ q })`, con las 100 últimas;
  - `getPurchase(id)`: líneas, pagos, saldo y notas.

**Interfaces:**
- Consumes: las RPC de las Tareas 1 y 2, y los esquemas de la Tarea 4.
- Produces:
  - **Server Actions:** cada una con `isAdminSession`, `adminErrorMessage` y, si cambia stock o visibilidad, `invalidateCatalog()`.
    - `createPurchaseAction` (genera `request_id` en el cliente, como `ManualSaleDialog`);
    - `updatePurchaseAction`;
    - `receivePurchaseAction`;
    - `correctArrivalAction`;
    - `recordPaymentAction`;
    - `voidPaymentAction`;
    - `applyCreditAction`;
    - `voidPurchaseAction`;
    - `savePurchaseNotesAction`.
  - **Portada de Compras**, en este orden:
    1. "Lo que debo" (`DebtsCard`).
    2. "Lo que falta llegar", con el botón "Llegó" en cada compra.
    3. "Historial", con buscador.
    4. El botón "Nueva compra".
  - **Formulario "Nueva compra":**
    - Elige el proveedor, con "Nuevo proveedor" en un diálogo, y la moneda (Bs o Dólares).
    - Las líneas se agregan de a una (producto existente con buscador, o "Juego nuevo": nombre y categoría) y cada una lleva cantidad y precio.
    - Tiene un "Adelanto" opcional (monto, moneda y dólar) que se registra con `recordPaymentAction` después de crear la compra.
  - **Detalle de la compra:** muestra el estado, las líneas (encargado, llegó y costo por unidad), el total y lo que se debe en su moneda, los pagos con su moneda y su dólar, y las notas. Sus botones:
    - "Llegó", que abre `ArrivalDialog` con las cantidades precargadas, el envío, el dólar y "Pagar el saldo ahora" opcional;
    - "Corregir llegada";
    - "Registrar pago";
    - "Anular" en cada pago y en la compra, con `ConfirmButton`;
    - con saldo a favor, "Usar en otra compra" (elige una compra del mismo proveedor con deuda) y "El proveedor me devolvió".
- [ ] **Step 1: e2e que falla:**
  - **compra BOB con adelanto:** crear una con "Juego encargado e2e" nuevo × 3 a Bs 100 y adelanto Bs 100 ⇒
    - aparece en "Lo que falta llegar";
    - "Lo que debo" muestra Bs 200 para el proveedor;
    - el juego **no** aparece en `/catalogo?q=Juego encargado e2e`.
  - **llegada:** "Llegó" con 3 unidades, envío Bs 30 y pagar el saldo de Bs 200 ⇒
    - la compra sale de pendientes y el proveedor queda sin deuda;
    - el stock del juego es 3 y el costo por unidad muestra Bs 110;
    - el juego sigue fuera del catálogo.
  - **compra USD:** 2 × US$ 10 con adelanto US$ 10 a 6,96 ⇒ "Lo que debo" muestra US$ 10.
  - **doble toque:** "Registrar pago" con una respuesta perdida (`cutActions('después')`) y reintento ⇒ un solo pago.
  - **anular:** una compra con pagos ⇒ `Primero anula los pagos de esta compra`.
  - **saldo a favor:** con un pago de más ⇒ aparece "Saldo a favor" y "Usar en otra compra" lo pasa a la compra elegida.
  - **celular:** `/panel/compras` no se desborda (se agrega a la prueba de desborde existente).
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): compras con encargo, llegada, pagos y saldo a favor`.

---

### Task 7: Costo y margen en la ficha del producto

**Files:**
- Create: `src/features/admin/purchases/CostPanel.tsx`, `e2e/panel-costos.spec.ts`
- Modify:
  - `src/app/panel/productos/[id]/page.tsx`: agrega la sección "Costo y ganancia";
  - `src/features/admin/queries.ts`: agrega `getProductCostSummary(id)` (RPC de la Tarea 3);
  - `src/features/admin/product-actions.ts`: agrega `setInitialCostAction`; `saveProductAction` traduce la violación de `products_visible_price` al mensaje exacto;
  - `src/features/admin/products/ProductForm.tsx`.

**Interfaces:**
- Produces: `CostPanel` muestra:
  - el costo vigente y su origen ("Última compra" o "Lo que ya tenías");
  - el margen en Bs y en % (precio actual − costo; sin costo, "Sin costo");
  - la última compra: proveedor, fecha, cantidad y costo por unidad;
  - el promedio;
  - las últimas compras;
  - lo vendido y la ganancia, más "N vendidas sin costo";
  - el campo **"Costo de lo que ya tenías (Bs)"** con "Guardar";
  - el botón **"Pedir de nuevo por WhatsApp"**, que usa `reorderMessage` con la cantidad de la última compra y solo aparece si el proveedor tiene WhatsApp.
- [ ] **Step 1: e2e que falla:**
  - **costo inicial:** un producto propio a precio Bs 200 con costo inicial Bs 120 ⇒ margen `Bs 80` y `40 %`;
  - **compra recibida** por `adminClient` y RPC, con línea 1 × 15000 y sin envío ⇒ costo `Bs 150` / "Última compra" y margen `Bs 50`;
  - **volver a pedir:** el enlace "Pedir de nuevo por WhatsApp" contiene el nombre del producto codificado;
  - **visibilidad:** un producto creado desde una compra (precio 0) con "Visible en la tienda" marcado al guardar ⇒ `Escribe un precio mayor que 0`, y sigue oculto.
  - unit (`product-actions`): si la base devuelve la violación de `products_visible_price` (23514), la acción responde `Pon un precio de venta antes de mostrar el producto`.
- [ ] **Step 2: Correr** → FAIL. **Step 3: Implementar.** **Step 4: Correr** → PASS. **Step 5: Commit** `feat(panel): costo, margen y ganancia en la ficha del producto`.

---

### Task 8: Publicación

- [ ] **Step 1: Docs.** `docs/PROYECTO.md` (estado, modelo de compras y costos, lecciones) y `docs/hosting.md` (nada nuevo en la nube salvo `db push`).
- [ ] **Step 2: Revisión final** (executing-plans) con su Review Focus; correcciones con TDD.
- [ ] **Step 3: [Diego]** `npx supabase db push` (2 migraciones); prueba en Android en la vista previa: crear un proveedor, una compra con adelanto, "Llegó" con envío y ver el costo en el producto.
- [ ] **Step 4: Merge** con el visto bueno de Diego, `npx repomix` y la memoria **en la rama antes de fusionar**; después, verificar producción.
