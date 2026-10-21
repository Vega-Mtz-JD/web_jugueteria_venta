# Etapa B — Inventario, proveedores y compras: documento de diseño

**Fecha:** 21/10/2026
**Amplía y reemplaza:** el §5.7 de `docs/superpowers/specs/2026-10-19-panel-dueno-design.md` (Etapa B). El resto de ese documento sigue valiendo: usuarios, anti-objetivos, la regla de que los costos nunca van en `products`, y el modelo de stock y de "apartadas" de la etapa A.
**Contexto:** `docs/PROYECTO.md`. En producción ya están los planes 1, 2, 3A (panel) y 4 (avisos y respaldos).

Cómo leer las marcas:
- **[cliente]**: lo dijo Diego en nombre del dueño.
- **[decisión mía]**: lo propuse yo; se puede cambiar.
- **[constructor]**: queda a criterio de quien construya.

---

## 1. Intención y por qué

Hoy el dueño anota en un **cuaderno** qué compra, a quién y a qué precio. Quiere tener **registro y datos de todo lo que compra y de todo lo que recibe** **[cliente]**. El objetivo final es saber **cuánto gana con cada juego** y, cuando algo se acaba, **a quién se lo compró la última vez y a qué precio**.

Cómo compra hoy **[cliente]**:
- Encarga la mercadería al proveedor y **a veces deja un adelanto**. El resto lo paga **cuando llega**.
- La mercadería **a veces llega días después, por bus**. La **encomienda se paga aparte**, y ese gasto **debe contar** en el costo de los juegos.
- Paga en **bolivianos** y, a veces, en **dólares**. Cuando paga en dólares, anota **a cuánto le salió el dólar**.
- Tiene en el cuaderno **algunos costos** de lo que hoy está en el estante, y quiere empezar a usarlos.
- Cuando encarga un juego que la tienda nunca vendió, **no quiere que aparezca en la tienda** hasta tenerlo en la mano, porque el encargo puede fallar a último momento.

Lo primero que quiere ver al abrir Compras **[cliente]**:
1. **Cuánto le debe a cada proveedor.**
2. **Qué falta que le llegue.**

**Lo que haría que vuelva al cuaderno [cliente]: que los números no cuadren con lo que pagó.**

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos:**
- Proveedores con un botón para escribirles por WhatsApp.
- Compras con dos momentos (encargo y llegada) y pagos parciales.
- El envío y el dólar se reflejan en el costo real.
- Costo y ganancia por producto, y deudas por proveedor.

**No objetivos:**
- Contabilidad general: caja, gastos que no son mercadería, impuestos.
- Pedidos al proveedor dentro de la web: siguen por WhatsApp, y el panel solo arma el mensaje.
- Gráficos de ventas, inventario y ganancia: son de la etapa C (plan 5), que usará estos datos.
- Pasar como compras las compras viejas del cuaderno: sumarían stock por segunda vez.

**Anti-objetivos:**
- **Números que no cuadran con lo que pagó [cliente].** Cada total, saldo, deuda y reparto del envío tiene que sumar exacto al centavo (§5).
- Costos o ganancias a la vista del público o de un comprador.
- Que un juego encargado aparezca en la tienda antes de llegar.
- Stock que sube dos veces por la misma mercadería, o que sube al encargar en vez de al llegar.

## 3. Usuarios y dispositivos

- **Quiénes:** el dueño y sus hijos, todos administradores con los mismos permisos (como en la etapa A).
- **Quién ve costos y ganancias:** todos los administradores **[decisión mía]**.
- **Dispositivos:** celular Android y PC. Botones grandes, pocos pasos y textos claros.

## 4. Lo que se construye

### 4.1 Proveedores

- **Datos:** nombre, persona de contacto, WhatsApp, notas y si está activo.
- **En la lista:** cuánto se le debe a cada uno.
- **En su ficha:**
  - el botón **"Escribir por WhatsApp"**;
  - sus compras;
  - **lo que se le debe** (en Bs y, aparte, en dólares si hay compras en dólares).
- Un proveedor con compras no se borra; se desactiva **[decisión mía]**.
- Se puede crear un proveedor desde el formulario de compra, sin salir de él.

### 4.2 Compras

**Una compra tiene:** proveedor, fecha del encargo, moneda (**Bs** o **US$**), "a cuánto te salió el dólar" (solo en dólares), nota y una o varias líneas. Cada línea lleva producto, cantidad y precio unitario en la moneda de la compra.

**Estados:**

| Estado | Qué significa | Stock |
|---|---|---|
| **Encargada** | Se pidió; puede tener un adelanto | No cambia |
| **Recibida** | Llegó (toda o en parte); se anotó la encomienda | Sube con lo que llegó (movimiento `compra`) |
| **Anulada** | Se registró por error o el encargo se cayó | Si estaba recibida, se resta lo que había sumado |

**Los pasos:**
1. **Encargar ("Nueva compra").**
   - Se elige el proveedor y se agregan productos, cantidades y precios.
   - Si es en dólares, se anota a cuánto salió el dólar.
   - Se puede anotar un **adelanto**.
   - Mientras está encargada, la compra se puede corregir.
2. **Llegó.**
   - De cada línea se anota **cuántas unidades llegaron**. Viene precargado con lo encargado y se puede bajar, incluso a 0.
   - Se anota el **costo de la encomienda**, en Bs y con 0 si no hubo.
   - Opcionalmente se anota el **pago del saldo**.
   - En ese momento suben los stocks y quedan fijados los costos.
3. **Pagos.**
   - Cada pago tiene fecha, **moneda** (Bs o US$, que puede no coincidir con la de la compra) y monto.
   - Lleva también **"a cuánto estaba el dólar ese día"**, que se pide si el pago es en dólares o si la compra es en dólares, y una nota **[cliente]**.
   - El dólar cambia mucho de un día a otro: por eso cada pago guarda el suyo, y así se convierte y se suma correctamente **[cliente]**.
   - Se pueden registrar varios (adelanto, saldo u otros).
   - Un pago mal registrado se **anula**, no se borra.

**Producto nuevo desde la compra [cliente]:**
- Si el juego no existe, se escribe su nombre y categoría, y se crea **oculto** (`is_active = false`) con stock 0.
- Al llegar, sube su stock, pero sigue oculto. El dueño le pone fotos y precio, y lo hace visible cuando quiere.
- Si la compra se anula antes de llegar, el producto oculto queda y se puede borrar desde Productos: como nunca se vendió, se borra de verdad.
- Como todavía no tiene precio de venta, se crea con **precio 0**. Mientras tenga precio 0, el panel no deja hacerlo visible **[decisión mía]**.

**Unidades que no llegaron [decisión mía]:**
- Lo que **se debe** se calcula sobre lo que **llegó**, no sobre lo encargado.
- Si el dueño pagó de más (adelantó por 10 y llegaron 8), la compra queda con **saldo a favor**. Qué se hace con él **depende del proveedor y del dueño [cliente]**, así que hay dos acciones:
  - **"Usar en otra compra"** del mismo proveedor: pasa el saldo como un pago de la otra compra y lo descuenta de esta, en una sola operación, para que las dos sumen bien;
  - **"El proveedor me devolvió"**: registra el dinero devuelto, con su moneda y su dólar, y deja la compra en cero.
- Cada compra y cada proveedor tienen una **nota de detalles por arreglar** **[cliente]**: lo que quedó pendiente de hablar con el proveedor.
- No hay segunda llegada: si lo que faltó llega después, se registra como una compra nueva.

**Corregir una llegada [decisión mía]:**
- Después de "Llegó" se puede usar **"Corregir llegada"** para cambiar:
  - el costo de la encomienda;
  - a cuánto salió el dólar;
  - las cantidades recibidas.
- Cambiar una cantidad ajusta el stock con el mismo motivo `compra`.
- Si se baja una cantidad que ya se vendió, no se permite y se explica, igual que al anular.
- Los costos se vuelven a calcular para las ventas **futuras**. Las ventas ya hechas conservan el costo que se copió en su momento.
- Así, un número mal escrito no obliga a anular y registrar todo de nuevo.

**Anular una compra [decisión mía]:**
- Solo se puede anular si **no tiene pagos vigentes**: primero se anulan sus pagos. Así nunca queda un pago "suelto" que descuadre la deuda.
- Si estaba recibida, se resta el stock que sumó. Si ya no alcanza, porque algo se vendió, no se anula y se explica cuántas unidades faltan (como en el spec del panel).

### 4.3 Costo real, ganancia e inventario

**Costo real de cada unidad** (en centavos de Bs):
- **Compra en Bs:** precio unitario + su parte del envío.
- **Compra en dólares:** precio unitario × **dólar efectivo de la compra** + su parte del envío.
  - **Dólar efectivo [decisión mía]:** promedio ponderado del dólar de los pagos, sobre la parte ya pagada; para la parte aún no pagada, el dólar anotado al marcar "Llegó".
  - Se recalcula al registrar cada pago, para las ventas **futuras**.
  - Cuando la compra queda pagada del todo, el costo en Bs = lo que realmente salió del bolsillo en Bs, sin el envío.
- **Reparto del envío:** proporcional al **valor** de cada línea recibida (cantidad × precio en Bs) **[decisión mía]**. Se hace al centavo, de modo que **la suma de las partes sea exactamente el envío** (§5).
- **Costo vigente de un producto:** el costo real de su **última compra recibida**. Si no hay ninguna, el campo **"Costo de lo que ya tenías"**. Si tampoco está, el producto queda **sin costo** y no se inventa un número. También se muestra el promedio de sus compras.

**"Costo de lo que ya tenías" [cliente]:**
- Es un campo opcional en la ficha del producto (en el panel), en Bs.
- No suma stock y se guarda en una tabla solo para administradores.

**Copia del costo en cada venta:**
- En cada venta web (al confirmar el pago) y en cada venta manual se guarda **el costo vigente en ese momento**, en una tabla solo para administradores. **Nunca** va en `order_items`, porque el comprador puede leerla.
- Las ventas anteriores a esta etapa quedan **sin costo** y se muestran aparte.
- **Ganancia de una venta** = (precio de venta − costo copiado) × cantidad, solo sobre productos (el envío al comprador no entra, como en el spec del panel).

**En la ficha del producto (panel):**
- costo vigente y su origen (última compra o "lo que ya tenías");
- margen: precio actual − costo vigente, en Bs y en %;
- última compra: proveedor, fecha, cantidad y costo real;
- historial de compras;
- unidades vendidas y ganancia acumulada desde que hay costos;
- **"Pedir de nuevo por WhatsApp"** al último proveedor, con un mensaje ya escrito con el nombre del juego y una cantidad sugerida **[constructor: cómo sugerirla]**.

### 4.4 Pantallas

- **Panel → Más → Compras** (también **Proveedores**). La portada de Compras muestra, en este orden **[cliente]**:
  1. **Lo que debo:** proveedores con saldo pendiente, monto y total.
  2. **Lo que falta llegar:** compras encargadas, con proveedor, fecha y días esperando, y un botón grande **"Llegó"**.
  3. **Historial** con buscador por proveedor o producto.
- Botón grande **"Nueva compra"**.
- **Producto (panel):** el bloque de costo y margen de §4.3 y el campo "Costo de lo que ya tenías".
- Celular primero: el formulario de compra debe poder llenarse en el celular, una línea a la vez.

## 5. Cuadrar los números (la regla que no se rompe)

**Dinero:**
- Todo el dinero va en **enteros**: centavos de Bs, y centavos de dólar para las compras en dólares. Nunca con decimales flotantes.
- El dólar se guarda con 4 decimales; cada conversión se redondea una sola vez al centavo, en el momento del pago.

**Igualdades que siempre se cumplen** (con pruebas):
- **Total de una compra** = Σ (cantidad recibida × precio unitario), en su moneda. Antes de llegar, es lo encargado.
- **Deuda de una compra** = total − Σ pagos vigentes, **en la moneda de la compra**. Si es negativa, es **saldo a favor**.
  - Un pago en otra moneda se convierte con **el dólar de ese pago**. Por ejemplo, Bs 700 a 7,00 pagan US$ 100 de una compra en dólares.
  - Los saldos usados en otra compra y las devoluciones entran como pagos (positivos o negativos), así todo suma.
- **Deuda con un proveedor** = Σ deudas positivas de sus compras no anuladas, separada por moneda. Los dólares no se pasan a Bs para sumar con lo demás.
- **Reparto del envío:** Σ partes = envío exacto, repartido al centavo con el método del resto mayor **[decisión mía]**.
- **Costo real de cada línea** (centavos exactos) = valor de la línea en Bs + su parte del envío.
  - Se guarda por línea, y Σ líneas = valor de la compra en Bs + envío, **exacto**.
  - El **costo por unidad** = costo de la línea ÷ cantidad, redondeado al centavo. Se usa para mostrar y para copiar en cada venta **[decisión mía]**.
  - La ganancia acumulada puede diferir de la exacta en medio centavo por unidad vendida como máximo; se documenta en la prueba.
- **Stock:** la suma de `stock_movements` de un producto sigue siendo igual a su stock (regla de la etapa A).

**Lo que ve el dueño:**
- El panel muestra cada pago en **la moneda en que pagó** y con su dólar, para que lo compare con su recibo. La deuda se muestra en la moneda de la compra.

## 6. Restricciones

- Todas las reglas de `CLAUDE.md` y del spec del panel:
  - funciones RPC `security definer` con `require_admin()`;
  - RLS en toda tabla nueva;
  - tablas de costos solo para administradores;
  - TDD;
  - Next 16 con `<Suspense>`;
  - `invalidateCatalog()` cuando cambia el stock o la visibilidad.
- El stock sigue cambiando **solo** con RPC y queda en `stock_movements`: la llegada usa el motivo `compra`, y la anulación de una compra recibida usa uno nuevo, `anulacion_compra`.
- Se reutilizan el patrón de `request_id` contra registros dobles (de las ventas manuales), `callAction` y `ConfirmButton`.
- **Plazo:** fines de noviembre de 2026; una sola fusión a `main`.

## 7. Lo que queda al constructor

- Nombres de tablas y funciones, y si "Llegó" y "pagar" son una o dos acciones en la base.
- Cómo sugerir la cantidad en "Pedir de nuevo por WhatsApp" (por ejemplo, la última cantidad comprada).
- Si el historial de compras se pagina o se limita, con la misma idea que el historial de pedidos.
- Si conviene mostrar el inventario valorizado (unidades × costo vigente) en Compras ya en esta etapa, o dejarlo para el dashboard del plan 5.
