# Etapa C — Dashboard con gráficos: documento de diseño

**Fecha:** 21/10/2026
**Amplía y reemplaza:** el §5.8 de `docs/superpowers/specs/2026-10-19-panel-dueno-design.md` (Etapa C) y la portada de la etapa A (§5.2), que este dashboard absorbe. El resto de ese documento sigue valiendo: usuarios, anti-objetivos y, sobre todo, **qué cuenta como venta** (§5.2).
**Se apoya en:** `docs/superpowers/specs/2026-10-21-inventario-proveedores-design.md` (compras, deudas, costo vigente y `sale_costs`).
**Contexto:** `docs/PROYECTO.md`. En producción: planes 1, 2, 3A, 4 y 3B.

Cómo leer las marcas:
- **[cliente]**: lo dijo Diego en nombre del dueño.
- **[decisión mía]**: lo propuse yo; se puede cambiar.
- **[constructor]**: queda a criterio de quien construya.

---

## 1. Intención y por qué

El dueño (o uno de sus hijos) abre el panel para saber **cuánto vendió y cuánto ganó, en el día o en el mes**, y **qué quedó pendiente**: ventas por atender, compras por llegar y deudas con proveedores **[cliente]**. Vieron otro sistema con un dashboard que mostraba "un resumen de todo" (ventas, compras, proveedores y pedidos, con lo pendiente resaltado) y les gustó **[cliente]**.

Lo que más le importa, en orden **[cliente]**:
1. **Cuánto ganó**, arriba. Sabe si le fue bien **comparándolo con el período anterior**.
2. **Lo pendiente**, abajo.

Para decidir qué volver a comprar, **mira lo que más se vende y lo que se está agotando** **[cliente]**. También le sirve saber **cuánto vale lo que tiene** y **cuántos clientes vuelven a comprar** **[cliente]**.

**Lo que haría que deje de usarlo: que los números no cuadren con lo que vendió [cliente].** Si un número le parece raro, quiere **tocarlo y ver la lista de ventas** que lo forma **[cliente]**.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos:**
- Una portada del panel que resume todo: ganancia con barras, pendientes, qué volver a comprar, inventario, clientes y pedidos.
- Un filtro de período que mueve todo lo que depende del tiempo.
- Una página **Ventas** con la lista que forma cada número, y cuya suma da exactamente ese número.

**No objetivos:**
- Contabilidad general: caja, gastos que no son mercadería, impuestos (igual que en las etapas A y B).
- Historia del inventario ("cuánto valía en septiembre"): no hay fotos del inventario guardadas; el inventario es siempre el de ahora.
- Clientes de las ventas en tienda o por WhatsApp: no se registra quién compró.
- Exportar a Excel o PDF, metas de ventas, avisos nuevos.
- Rango de fechas libre (del día X al día Y): solo los períodos fijos de §4.1.

**Anti-objetivos:**
- **Números que no cuadran con lo que vendió [cliente]:** el resumen, la lista de ventas y cualquier otra pantalla del panel tienen que dar lo mismo al centavo (§5).
- Ganancia inflada o inventada: una venta sin costo conocido nunca cuenta como ganancia completa ni con un costo supuesto.
- Costos o ganancias a la vista del público o de un comprador.
- Una portada lenta en el celular.

## 3. Usuarios y dispositivos

- **Quiénes:** el dueño y sus hijos, todos administradores con los mismos permisos.
- **Dispositivos:** celular Android y la PC de la tienda. Al dueño le cuesta la tecnología: números grandes, textos claros y pocas decisiones por pantalla.
- **En la PC**, la portada usa dos columnas: ganancia y pendientes a la izquierda; lo demás a la derecha **[decisión mía]**. En el celular, una columna en el orden de §4.

## 4. Lo que se construye

### 4.1 Período

Botones arriba de todo: **Hoy · 7 días · Este mes · Mes anterior · 12 meses** (como en el §5.8 original, sin "30 días" para no tener dos casi iguales **[decisión mía]**). Por defecto: **Este mes** **[decisión mía]**. Va en la dirección (`?periodo=…`) para que se pueda volver atrás y compartir.

Todo en hora de La Paz (`America/La_Paz`). Las semanas empiezan el **lunes** **[decisión mía]**.

**Regla de la comparación [decisión mía]:** el período anterior tiene el mismo largo y se corta **en el mismo punto**, para no comparar algo a medias contra algo completo. Si el período elegido termina ahora (hoy a las 10:00, el 21 del mes), el anterior termina en el momento equivalente:

| Período | Barras | Se compara con **[decisión mía]** |
|---|---|---|
| Hoy | los últimos 7 días, uno por barra; hoy resaltado | ayer **hasta la misma hora** |
| 7 días (hoy y los 6 anteriores) | 7 barras, una por día | los 7 días anteriores, cortando el último a la misma hora de hoy |
| Este mes | una barra por semana del mes (la primera y la última pueden ser parciales) | el mes anterior **hasta el mismo día** (del 1 al 21 de septiembre si hoy es 21 de octubre), para no comparar medio mes contra un mes entero |
| Mes anterior | una barra por semana de ese mes | el mes de antes, completo |
| 12 meses (este mes y los 11 anteriores) | 12 barras, una por mes | los mismos 12 meses un año antes, hasta el mismo día |

### 4.2 Arriba: la ganancia (boceto B elegido **[cliente]**)

- Título con el período en palabras: "Ganaste en octubre", "Ganaste hoy", "Ganaste en los últimos 7 días".
- **Ganancia** en grande = Σ (precio − costo) × cantidad de las ventas del período **con costo conocido** (§5).
- **Comparación** en una línea: "▲ Bs 350 más que septiembre" o "▼ Bs 120 menos que ayer" (rango del anterior según §4.1).
  - **Si alguno de los dos períodos tiene ventas sin costo anotado, no se compara la ganancia** (saldría engañosa: las ventas anteriores al plan 3B no tienen costo). En su lugar se comparan **las ventas**: "Vendiste Bs 800 más que septiembre · la ganancia no se compara porque faltan costos" **[decisión mía]**.
  - Si el período anterior no tiene ventas, una frase neutra en vez de la flecha **[constructor el texto]**.
- **Barras de ganancia** según la tabla de §4.1, con el monto encima de cada barra y la etiqueta debajo (día, "sem 1", mes). La barra del período actual va resaltada.
  - Hechas a mano con HTML/CSS o SVG, **sin librería de gráficos** **[decisión mía]**: son pocas barras y la página debe cargar rápido en el celular.
  - Una barra negativa (vendió por debajo del costo) se dibuja hacia abajo y en otro color **[decisión mía]**.
- Debajo: **"Vendiste Bs X (N ventas, M juegos) · te costaron Bs Y"** y las ventas por canal: **Web · Tienda · WhatsApp**.
- Si hay ventas sin costo conocido en el período: **"Bs Z en ventas sin costo anotado: no entran en la ganancia"**, con un enlace para ver cuáles son (la lista de ventas filtrada a "sin costo").
- **Todo número de esta sección se puede tocar** y abre la lista de ventas (§4.7) con el mismo filtro **[cliente]**:
  - la ganancia, las ventas o "te costaron" → el período;
  - un canal → el período y ese canal;
  - una barra → ese día, esa semana o ese mes **[decisión mía]**.

Se mantienen arriba los atajos que ya existen: **"Nuevo producto"** y **"Vendí en tienda"**.

### 4.3 Pendiente (siempre "ahora", no depende del período)

Recuadros que llevan a su sección. Lo urgente va en rojo:
- **Pedidos por revisar** (`en_revision`). Rojo si alguno lleva más de 24 horas (como hoy).
- **Por enviar o entregar** (`pagado`, `enviado`, `listo_para_recoger`).
- **Compras por llegar**: cantidad de compras `encargada`. Lleva a Compras.
- **Debes a proveedores**: la deuda total, **en Bs y en US$ por separado**, sin convertir, igual que en Compras. Rojo si es más de cero **[decisión mía]**. Lleva a Compras.

### 4.4 Qué volver a comprar

- **Lo más vendido** del período: los **10 primeros por unidades** (empate: por ingresos). Cada uno con unidades, ingresos, ganancia (o "sin costo") y el stock de ahora. Tocar uno abre su ficha en el panel.
  - El §5.8 original pedía "por cantidad y por ingresos": un selector **Unidades / Ingresos** que reordena la misma lista **[decisión mía]**.
- **Se está agotando**: los productos **visibles** con stock **disponible** de **0 a 3** (lo que aún se puede vender, igual que el filtro "poco stock" de Productos), ordenados primero por lo que se vendieron en los **últimos 30 días** (sin importar el período elegido) y luego por stock **[decisión mía]**. Muestra el stock y, si hay una compra recibida, el botón **"Pedir de nuevo"**, que abre el WhatsApp del último proveedor con el mismo mensaje que ya arma la ficha del producto (plan 3B).
  - Hasta 10 en la portada; "Ver todos" lleva a Productos con el filtro de poco stock **[decisión mía]**.

### 4.5 Inventario (siempre "ahora")

Sobre lo que hay **físicamente en la tienda**: unidades = stock disponible + unidades **apartadas** por pedidos web pendientes (siguen en el estante hasta que se entregan). Cuenta los productos con alguna unidad, visibles u ocultos (un juego oculto en el estante también vale), **sin contar los productos de ejemplo** (`is_sample`) **[decisión mía]**:
- **Juegos** (productos distintos) y **unidades**.
- **Valor a costo** = Σ stock × costo vigente (la última compra recibida o "lo que ya tenía", como en el plan 3B).
- **Valor a precio de venta** = Σ stock × precio.
- **Si vendes todo, ganarías** = la diferencia, calculada **solo sobre los productos que tienen costo y precio** **[decisión mía]**.
- Aparte, con enlace a la lista: **"N juegos sin costo anotado (U unidades)"** y **"N juegos sin precio"** (los creados desde una compra, que nacen con precio 0).
- Si hay productos de ejemplo con stock, una línea: "No se cuentan N juegos de ejemplo; puedes borrarlos en Ajustes".

### 4.6 Clientes y pedidos

**Clientes** (solo tienda web; se dice en pantalla):
- **Compraron** en el período: clientes distintos con al menos un pedido que cuenta como venta, con fecha de venta en el período.
- **Nuevos**: los que tienen su **primera** venta de toda la historia dentro del período.
- **Volvieron a comprar**: los que ya tenían una venta **antes** del período. Compraron = nuevos + volvieron.

**Pedidos por estado** (franja corta, no gráfico grande): cuántos pedidos **creados en el período** están ahora en cada estado: esperando pago, en revisión, pagado, enviado o listo, entregado, cancelado o rechazado, reembolsado **[decisión mía]**. Cada estado lleva a Pedidos con ese filtro si existe **[constructor]**.

### 4.7 Página Ventas (nueva: `/panel/ventas`)

Es la lista de **todo lo que cuenta como venta**, línea por línea:
- Cada fila: fecha y hora, canal (Web / Tienda / WhatsApp), juego, cantidad, precio unitario, costo unitario, ganancia de la línea. Si no tiene costo, dice **"sin costo"** y se resalta.
  - Una fila web lleva a su pedido; una de tienda o WhatsApp lleva a la ficha del producto **[decisión mía]**.
- **Filtros**: los mismos períodos de §4.1 más el día, la semana o el mes de una barra; canal; "solo sin costo". Van en la dirección.
- **Totales arriba de la lista**: ventas (Bs, cantidad de ventas, juegos), costo, ganancia y "sin costo". **Tienen que dar exactamente lo mismo que el número que se tocó.**
- Más recientes primero. Si son muchas, se pagina o se limita con aviso **[constructor]**, pero los totales siempre cubren **todo** el filtro.
- Se llega desde los números de la portada y desde **Más → Ventas** **[decisión mía]**.

### 4.8 Qué pasa con la portada actual

El dashboard **reemplaza** la portada actual (`/panel`): sus tarjetas (por revisar, por entregar, poco stock, agotados, ventas de hoy y del mes) quedan dentro de §4.2–§4.4. "Envíos cobrados" sigue apareciendo aparte, en el bloque de ventas, porque no es venta de productos **[decisión mía]**.

## 5. Cuadrar los números (la regla que no se rompe)

**Qué es una venta** (igual que en la etapa A, sin excepciones):
- **Pedido web** en `pagado`, `enviado`, `listo_para_recoger` o `entregado`. Su fecha es la de la **confirmación del pago** (el último evento a `pagado`), en hora de La Paz.
- **Venta manual** (tienda o WhatsApp) **no anulada**. Su fecha es la de registro.
- **No cuentan:** `reembolsado`, `cancelado`, `rechazado`, `esperando_pago`, `en_revision`, ni las ventas manuales anuladas. Si un pedido se reembolsa, sale de todos los números de ese período.
- **Monto de una venta**: el precio de los productos (subtotal). **El envío cobrado no es venta** y se muestra aparte.
- **"N ventas"** cuenta pedidos web y ventas manuales; **"M juegos"** cuenta unidades.

**Costo y ganancia** (del plan 3B):
- El costo de cada línea vendida es el que quedó **copiado** en `sale_costs` al confirmar el pago o al registrar la venta manual. **Nunca se recalcula** con el costo de hoy.
- **Ganancia** = Σ cantidad × (precio − costo) de las líneas con costo.
- Las líneas **sin costo** (ventas anteriores al plan 3B o juegos sin costo anotado) se suman aparte como "ventas sin costo anotado". No entran ni en "te costaron" ni en la ganancia.

**Igualdades que siempre se cumplen** (con pruebas en la base):
- Ventas del resumen = Σ de la lista de ventas con el mismo filtro, al centavo y en cantidad.
- Ventas = Σ por canal = Σ de las barras del período.
- Ganancia del resumen = Σ de las barras = Σ de la lista.
- Ventas con costo − "te costaron" = ganancia.
- Ventas = ventas con costo + ventas sin costo.
- Ventas de hoy y del mes en el dashboard = lo que mostraba la portada de la etapa A (misma regla y misma fecha).
- La ganancia de un producto en el dashboard coincide con la de su ficha (`admin_product_cost_summary`) para las mismas ventas.
- Deuda con proveedores = la de la portada de Compras (`purchase_balances`).
- Inventario a costo usa el mismo costo vigente que muestra la ficha del producto.

**Todo el dinero en enteros** (centavos), sumado en la base. La pantalla solo da formato con `formatBs`.

## 6. Restricciones

- Todas las reglas de `CLAUDE.md` y del spec del panel:
  - los datos salen de funciones RPC `security definer` con `require_admin()`; nada de costos fuera de ellas;
  - TDD (pgTAP para las cuentas y las igualdades de §5, unitarias para fechas y períodos, e2e en celular y PC);
  - Next 16 con `<Suspense>` para `searchParams` y la sesión; sin `"use cache"` (son datos de admin con sesión).
- **Rendimiento:** la portada se arma con **una o pocas llamadas** a la base, no una por recuadro **[decisión mía]**. Debe sentirse rápida en un Android con datos móviles.
- **Accesibilidad:** las barras tienen sus montos como texto (no solo la altura), y la comparación no depende solo del color (lleva ▲/▼ y palabras).
- **Sin dependencias nuevas** para los gráficos **[decisión mía]**.
- **Plazo:** primera quincena de diciembre de 2026; una sola fusión a `main`.

## 7. Lo que queda al constructor

- Nombres y forma de las funciones de la base (una sola para la portada o varias), y si la lista de ventas es una vista o una función.
- Textos exactos de la comparación cuando el período anterior es cero o no hay ventas.
- Cómo se ve cada barra (ancho, colores dentro de la paleta del panel) y cómo se tocan las barras en el celular.
- Paginación o límite de la lista de ventas.
- Si los estados de "Pedidos por estado" enlazan a Pedidos con filtro (si el filtro no existe, sin enlace).
- Cómo se marca en la portada que un período no terminó ("en curso").
