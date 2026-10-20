# Panel del dueño, inventario y proveedores — Documento de diseño

**Fecha:** 19/10/2026
**Amplía:** `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md` (§5.5 panel, §5.7 estadísticas). Lo que no cambia este documento sigue valiendo allí.
**Contexto del proyecto:** `docs/PROYECTO.md`

Cómo leer las marcas:
- **[cliente]**: lo dijo Diego en nombre del cliente.
- **[decisión mía]**: lo propuse yo; se puede cambiar.
- **[constructor]**: queda a criterio de quien construya.

---

## 1. Intención y por qué

El dueño, **junto con sus hijos**, quiere **administrar casi todo** desde la web **[cliente]**. Hace poco vieron otro sistema "casi completo", con **gráficos de ventas e inventario**, y les gustó **[cliente]**.

Hoy trabajan así:
- **Compras:** anotan en un **cuaderno** qué compraron, a quién y a qué precio.
- **Pedidos:** coordinan por WhatsApp lo que piden a los proveedores y lo que les piden los clientes **[cliente]**.

El panel debe:
1. **Permitir vender ya.** Revisar las capturas de pago, confirmar, enviar y cargar los productos reales. Sin el panel, la tienda web no puede atender ni un pedido.
2. **Reemplazar el cuaderno.** Registrar proveedores y compras para saber **cuánto se gana con cada juego** y, cuando algo se agota, **a quién se le compró la última vez y a qué precio** **[cliente]**.
3. **Dar una vista completa.** Un dashboard con gráficos de ventas e inventario, como el que les gustó.

## 2. Usuarios

- **El dueño y sus hijos.** Cada uno tiene **su propia cuenta de administrador**, y todos tienen los mismos permisos **[cliente para varios; decisión mía para "iguales"]**.
- **Dispositivos:** celular **Android** y la **PC de la tienda**. Al dueño le cuesta la tecnología: botones grandes, pocas decisiones por pantalla y textos claros.

## 3. Objetivos, no objetivos y anti-objetivos

**Objetivos:** los de las etapas en §5.

**No objetivos (por ahora):**
- Contabilidad completa: impuestos, caja, gastos que no sean compras de mercadería.
- Facturación electrónica (SIAT).
- Permisos distintos entre administradores.
- Varias sucursales.
- Pedidos a proveedores dentro de la web (se siguen haciendo por WhatsApp; el panel solo ayuda con un enlace).
- Un catálogo de proveedores por producto con varios precios a la vez.

**Anti-objetivos (sería un fracaso aunque funcione):**
- Que el dueño necesite ayuda para confirmar un pago o cargar un producto.
- **Números que no cuadran:** stock negativo, ventas contadas dos veces, un pedido cancelado que no devuelve stock.
- **Que los costos o la ganancia queden a la vista del público.** La tabla `products` se puede leer públicamente, así que **los costos nunca se guardan ahí**.
- Que un comprador pueda entrar al panel o a sus datos.
- Que la portada tarde en cargar en el celular.

## 4. Restricciones

- **Plazo:**
  - **Etapa A (panel para vender):** lista alrededor del **1 de noviembre de 2026**.
  - **Avisos y respaldos (plan 4):** antes del **15 de noviembre**.
  - **Etapa B (inventario y proveedores):** fines de noviembre.
  - **Etapa C (dashboard con gráficos):** primera quincena de diciembre.
- **Técnicas:**
  - Todas las reglas del proyecto en `CLAUDE.md`: Next 16 con Cache Components y `<Suspense>`, la base como fuente de verdad, funciones RPC, RLS en todas las tablas y TDD.
  - **Créditos de Netlify:** fusionar a `main` una vez por etapa.
  - **Supabase gratis, 1 GB de archivos:** las fotos de productos se comprimen en el celular antes de subirse (WebP, lado máximo 1600 px).
- **Idioma, moneda y fechas:** todo en español; moneda Bs (en centavos en la base); fechas y horas en la zona `America/La_Paz`.

## 5. Lo decidido

### 5.1 Acceso y estructura del panel

- **Rutas:** el panel vive en **`/panel`**.
- **Protección:**
  - el `proxy.ts` manda a `/ingresar?siguiente=/panel…` a quien no tiene sesión;
  - si la cuenta no es admin, `/panel` responde "no encontrado";
  - la seguridad real la ponen las funciones y la RLS, que ya verifican `is_admin()`.
- **Acceso desde la tienda:** para una cuenta admin, el menú de usuario muestra **"Panel"**.
- **Primer administrador:** lo marca Diego una sola vez con una consulta SQL documentada en `docs/hosting.md`. Desde ahí, los demás se agregan en el propio panel (§5.6).
- **Instalable en Android (PWA):** con manifest, nombre "Ludiq Panel", ícono del cubo, `start_url /panel` y `display: standalone`. El *service worker* para las notificaciones llega en el plan 4 **[decisión mía]**.
- **Navegación** **[decisión mía]**:
  - **en celular**, una barra inferior fija con **Inicio · Pedidos · Productos · Más** (en "Más" están Proveedores, Ajustes, etc.);
  - **en PC**, un menú lateral con las mismas secciones;
  - **en las listas de PC**, la lista a la izquierda y el detalle a la derecha.
- **Estilo:** la misma paleta "Ludoteca cálida", pero sobrio, sin efectos de entrada y con botones de al menos 44 px de alto.
- **Navegación del navegador:** cada acción importante deja una URL propia (por ejemplo `/panel/pedidos/<id>`), para que el botón "atrás" del celular funcione como se espera.

### 5.2 Etapa A — Portada del panel (números clave, sin gráficos)

Tarjetas grandes que llevan a su sección:
- **Pedidos por revisar.** Cantidad en `en_revision`. Si alguno lleva **más de 24 horas**, se resalta (spec §5.4).
- **Por enviar o entregar.** Pagados que aún no salieron, más enviados o listos sin entregar.
- **Ventas de hoy** y **ventas del mes:** el monto en Bs y la cantidad.
- **Productos con poco stock.** Los activos con stock entre 1 y 3, y los agotados aparte. Se puede tocar para ver la lista.
- **Atajos:** "Nuevo producto" y "Vendí en tienda".

**Qué cuenta como venta, en todo el panel:**
- **Pedidos web:** los que están en estado `pagado`, `enviado`, `listo_para_recoger` o `entregado`. Cuentan en la fecha en que se **confirmó el pago** (el evento a `pagado` en `order_events`).
- **Ventas manuales** (tienda o WhatsApp, §5.4).
- **No cuentan:** `reembolsado`, `cancelado`, `rechazado`, `esperando_pago` ni `en_revision`.

**Qué monto se muestra** **[decisión mía]**:
- **"Ventas"** es solo el valor de los **productos** (`subtotal` de los pedidos web más las ventas manuales), para comparar web y tienda con la misma regla.
- **Los envíos cobrados** se muestran aparte ("Envíos cobrados: Bs X"). En el detalle de cada pedido se sigue viendo el **total**, que es lo que el comprador pagó y el dueño ve en su billetera.
- **La ganancia** (etapa B y C) se calcula solo sobre los productos. El envío no entra, porque normalmente cubre lo que cuesta llevar el pedido.

### 5.3 Etapa A — Pedidos

**Pestañas:**
- **Por revisar:** `en_revision`, de la más antigua a la más nueva.
- **Por entregar:** `pagado`, `enviado` y `listo_para_recoger`.
- **Historial:** todos los pedidos, con buscador por código `#0231` o por nombre, y filtro por estado. Los pedidos en `esperando_pago` solo aparecen aquí, con ese filtro (spec §5.4).

**Detalle del pedido:**
- Las capturas en grande, con zoom y todas las que se hayan subido.
- El **monto esperado** y el **código**, para buscarlos en la app de Yape u otra billetera.
- Los productos, la entrega, la factura y el historial.
- Los datos del cliente con un botón **"Escribir al cliente por WhatsApp"**, con un mensaje ya escrito que incluye el código.

**Acciones según el estado** (botones grandes; los que deshacen algo piden confirmación):

| Estado | Acciones |
|---|---|
| `en_revision` | **Confirmar pago** → `pagado`. **Rechazar** → `rechazado`, con un motivo obligatorio: atajos "Monto incorrecto", "No se ve el pago", "No encontramos el pago" o texto libre |
| `pagado` | Recojo → **Listo para recoger**. Envío en la ciudad → **Enviado**. Encomienda → **Enviado**, que pide **agencia** y **número de guía**, y una **foto del comprobante** opcional |
| `enviado` / `listo_para_recoger` | **Entregado** |
| `pagado`, `enviado` o `listo_para_recoger` | **Reembolsar** → `reembolsado`. Devuelve el stock y tiene confirmación. El dinero se devuelve por fuera de la web |
| `esperando_pago` / `rechazado` | **Cancelar** → `cancelado`. Devuelve el stock |

- **Cómo se ejecutan:** cada transición es una **función RPC de admin**. La función valida el estado de origen, el estado de destino y los datos obligatorios; registra el evento con `actor = 'admin'` (el trigger ya existe), y devuelve el stock cuando corresponde. Una transición inválida devuelve un error `P0001` con un mensaje claro.
- **Concurrencia:** si dos administradores tocan el mismo pedido a la vez, el segundo recibe "Este pedido ya cambió; recarga la página" **[decisión mía]**.
- **Comprobante de la encomienda:** su foto va a un bucket privado, que puede leer el comprador dueño del pedido.

### 5.4 Etapa A — Productos y ventas manuales

**Stock disponible y reservas** **[decisión mía]**:
- El número `stock` de la base es lo **disponible para vender**. Los pedidos web sin terminar de pagar (`esperando_pago`, `en_revision`) ya lo descontaron (plan 2).
- El panel muestra, junto al stock, **"N reservadas en pedidos"**, con un enlace a esos pedidos.
- Para **corregir el stock**, el dueño escribe lo que **cuenta en el estante** (unidades físicas). El sistema resta las reservadas y guarda el disponible. Así, contar el estante nunca infla el stock.

**Lista de productos:**
- Buscador y filtros: categoría, activos, ocultos y agotados.
- Botones **+ / −** de stock en cada fila: son ajustes rápidos sobre el disponible. Para un conteo completo se usa "Corregir stock (contar estante)".
- Botón **"Vendí"** en cada producto (§ más abajo).

**Formulario del producto:**
- **Fotos:** hasta **5**, tomadas con la cámara o elegidas de la galería. Se pueden reordenar, y la primera es la principal. Se comprimen antes de subirse.
- **Datos:** nombre, categoría, precio, precio anterior (marca la oferta), descripción, edad mínima, jugadores mínimo y máximo, stock, "Nuevo" y "Visible en la tienda".
- **Dirección web (`slug`):** se genera sola desde el nombre y es única.

**Borrar un producto:**
- Si alguna vez se vendió, **solo se oculta**, para conservar los pedidos y el historial.
- Si nunca se vendió, se borra con confirmación.

**Cambios visibles al instante:** cada cambio de producto, categoría o ajuste invalida la caché del catálogo con `updateTag("catalogo")`, así la tienda lo muestra enseguida.

**Ventas manuales ("Vendí en tienda / por WhatsApp")** **[cliente para tienda; decisión mía incluir WhatsApp ya en la etapa A]**:
- Se elige el producto, la **cantidad**, el **canal** (Tienda o WhatsApp) y el **precio unitario**. El precio viene con el actual, pero se puede cambiar para descuentos.
- Se puede agregar una nota opcional.
- Una función RPC registra la venta y **descuenta el stock**.
- **Si el stock no alcanza:** no se vende y aparece el mensaje "El stock registrado no alcanza (quedan N disponibles). Corrige el stock primero" **[decisión mía]**. Así nunca hay stock negativo.
- **Si la unidad está reservada por un pedido web:** la venta manual **no** se la quita. El mensaje dice qué pedido la tiene y hasta cuándo vence. El dueño decide: esperar, o cancelar ese pedido desde el panel si todavía no tiene captura **[decisión mía]**. Así no se pierde una venta que el comprador quizá ya está pagando.
- **Anular una venta manual** (por un error): devuelve el stock y queda registrado.

**Historial de stock (desde la etapa A, para que el inventario de la etapa B esté completo):**
- Tabla `stock_movements`: producto, cambio (+/−), **motivo** y referencia, quién y cuándo.
- Los motivos son `venta_web`, `devolucion_web`, `venta_manual`, `anulacion_venta_manual`, `compra` (etapa B), `ajuste` (+/− o edición del stock) y `alta` (stock inicial).
- **Todo** cambio de stock queda registrado, también los que hacen las funciones del plan 2 al crear, cancelar o vencer pedidos **[decisión mía: un trigger sobre `products.stock` con el motivo indicado por quien lo cambia, igual que `app.actor`]**.

### 5.5 Etapa A — Ajustes

- **Tienda:** nombre, lema, WhatsApp, dirección y horario de recojo.
- **Tarifas de envío:** a domicilio y en punto de encuentro.
- **Zonas:** crear, editar, ordenar, activar y desactivar; cada una con su modo (domicilio o punto).
- **Puntos de encuentro:** crear, editar, ordenar, activar y desactivar.
- **Billeteras QR:**
  - nombre, **imagen del QR** (se sube al bucket `store-assets`), titular, orden y si está activa;
  - **acá se reemplazan los QR de ejemplo por los reales**.
- **Categorías:** crear, editar y ordenar. Solo se borran si no tienen productos.
- **Borrar productos de prueba:** el botón llama a `delete_sample_products()`, con confirmación.

### 5.6 Etapa A — Administradores

- **Lista** de administradores, con nombre y correo.
- **Agregar** escribiendo el **correo de una cuenta que ya exista**. Si no existe, el mensaje dice "Esa persona primero debe crear su cuenta en la tienda".
- **Quitar** a un administrador.
- **Reglas:**
  - nadie puede quitarse a sí mismo;
  - siempre queda **al menos uno**.
- Todo esto se hace con una función RPC de admin; el rol nunca se edita directo desde la API (plan 1).

### 5.7 Etapa B — Proveedores, compras y ganancia

**Proveedores:**
- Datos: nombre, persona de contacto, **WhatsApp**, notas, activo.
- Cada proveedor tiene un botón "Escribir por WhatsApp".

**Compras (reemplaza el cuaderno):**
- Se registra la fecha, el proveedor, una nota y una o varias líneas (producto, cantidad y **costo unitario**).
- Una función RPC **suma el stock** (movimiento `compra`) y guarda el costo.
- Una compra registrada por error se puede **anular**: resta ese stock si todavía alcanza; si no, se explica por qué no se puede.

**Inventario y costo inicial** **[decisión mía]**:
- Lo que ya está en el estante entra en la etapa A como stock de `alta`, sin costo.
- En la etapa B, cada producto tiene un campo opcional **"Costo de lo que ya tenías"**, que el dueño llena si lo sabe por su cuaderno. Se guarda en una tabla solo de admin.
- Ese campo **no suma stock**: es el costo de las unidades que ya existían. Se usa hasta que haya una compra registrada.
- Las compras viejas del cuaderno **no** se pasan como compras, porque sumarían stock por segunda vez. Si se quiere guardar esa historia, el constructor puede ofrecer una "compra histórica" que solo registra el costo y la fecha, sin tocar el stock.

**Costo y ganancia** **[decisión mía]**:
- **Costo de un producto:** el de su **última compra**; si no hay ninguna, el "costo de lo que ya tenías". Se muestra también el costo promedio de las compras.
- **Dónde se guarda:** solo en tablas de admin (`purchases`, `purchase_items`), nunca en `products`.
- **Copia del costo en cada venta:** en cada venta web y manual se guarda una **copia del costo vigente** (en tablas o columnas solo de admin). Así, la ganancia de una venta no cambia si después sube el costo.
- **Ganancia de una venta:** (precio de venta − costo copiado) × cantidad.
- **Ventas sin costo conocido:** las que ocurrieron antes de registrar cualquier compra cuentan como "sin costo" y se muestran aparte; no se inventa un costo.

**En la ficha del producto (en el panel):**
- Última compra: proveedor, fecha, cantidad y costo.
- Margen: precio actual − último costo, en Bs y en porcentaje.
- Historial de compras y de movimientos de stock.
- Botón **"Pedir de nuevo por WhatsApp"** al último proveedor, con un mensaje ya escrito (nombre del producto y cantidad sugerida).

### 5.8 Etapa C — Dashboard con gráficos

Lo que se muestra, siempre con un **filtro de período** (hoy, 7 días, 30 días, este mes, mes anterior, 12 meses):
- **Ventas** por día y por mes, en Bs y en cantidad, separadas por **canal** (web, tienda y WhatsApp).
- **Lo más vendido:** los 10 primeros, por cantidad y por ingresos.
- **Ganancia estimada** del período, más las ventas sin costo conocido.
- **Inventario:** cantidad de productos y unidades, **valor a costo** y **valor a precio de venta**, poco stock y agotados.
- **Pedidos por estado.**
- **Clientes nuevos y recurrentes.**
- **Ventas por forma de entrega y por departamento.**
- **Comparación** del mes actual contra el anterior.

Los gráficos siguen la skill `dataviz` y se leen bien en celular.

### 5.9 Avisos (plan 4, sin cambios)

Notificación web (Web Push) al celular o a la PC de cada administrador cuando entra un pedido o una nueva captura, y correos al comprador (spec §5.6).

## 6. Etapas

| Etapa | Contenido | Fecha objetivo |
|---|---|---|
| **A — Panel para vender** | §5.1 a §5.6 | ~1 de noviembre |
| **Plan 4 — Avisos y respaldos** | spec §5.6 + respaldos | antes del 15 de noviembre |
| **B — Inventario y proveedores** | §5.7 | fines de noviembre |
| **C — Dashboard** | §5.8 | primera quincena de diciembre |

Cada etapa tiene su propio plan detallado, su rama, su vista previa y **una sola** fusión a `main`.

**Prioridad dentro de la etapa A, por si no alcanza el tiempo** **[decisión mía]**:
1. **Imprescindible:**
   - acceso al panel;
   - pedidos: revisar, confirmar, rechazar, enviar, entregar y cancelar;
   - productos con fotos;
   - ajustes de la tienda y **billeteras QR reales**;
   - "Vendí en tienda";
   - el historial de stock (`stock_movements`), porque sin él la etapa B queda incompleta.
2. **Importante:**
   - portada con números;
   - corregir stock contando el estante, con las reservas;
   - zonas y puntos de encuentro (mientras tanto sirven los de ejemplo, o se editan desde Supabase);
   - administradores desde el panel (el primero se marca por SQL);
   - PWA instalable.
3. **Puede pasar a la etapa B:**
   - ventas por WhatsApp y anular una venta manual;
   - reordenar fotos;
   - buscador del historial de pedidos;
   - categorías desde el panel.

Si el 1 de noviembre solo está lo imprescindible, se fusiona eso: es lo que permite vender. Lo demás entra en la siguiente fusión.

## 7. Lo que queda a criterio del constructor

- La librería de gráficos (etapa C).
- La forma exacta de las tablas de la etapa B y de `stock_movements`, mientras se cumpla lo de arriba y los costos queden solo para admin.
- Cómo se dividen las pantallas del panel en componentes.
- El diseño exacto del manifest y de los íconos de la PWA.
- La paginación del historial de pedidos y movimientos (con 50 productos alcanza una paginación simple).
