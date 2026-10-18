# Tienda online de juegos de mesa — Documento de diseño

**Fecha:** 2026-10-18
**Cliente:** tienda física de juegos de mesa y juguetes de razonamiento en La Paz, Bolivia
**Desarrollador:** Diego (construye y mantiene; está aprendiendo Next.js + Supabase con este proyecto)
**Bocetos de referencia:** `docs/superpowers/mockups/` (`flujo-compra.html`, `estilo-b-v3-illimani.html`). Son fragmentos HTML del servidor de bocetos: se ven mejor dentro de él.

En este documento:
- **[cliente]**: lo decidió o lo dijo el desarrollador en nombre del cliente.
- **[decisión mía]**: lo propuse yo durante la conversación y quedó así. Se puede cambiar.
- **[constructor]**: queda a criterio de quien construya.

---

## 1. Intención y por qué

Hoy la tienda vende en su local físico y se promociona un poco por redes sociales y WhatsApp. Los pagos se confirman a mano: el comprador manda por WhatsApp la captura de su Yape y el dueño la revisa.

La web debe:
1. Dejar que cualquiera vea todo el catálogo sin tener que escribir por WhatsApp para preguntar.
2. Ordenar las ventas a distancia: el pedido, la captura del pago, la forma de entrega y su estado quedan en un solo lugar, no repartidos en chats.
3. Estar lista **antes de Navidad**, con semanas de margen para que el dueño aprenda a usarla antes de la temporada fuerte.
4. Servirle a Diego como **pieza de portafolio** para conseguir otros clientes. El diseño tiene que verse profesional desde el primer segundo, sobre todo en celular.

Modelo de negocio entre Diego y el cliente: una prueba casi gratis primero. Cuando el cliente se adapte, acordarán mensualidades y mejoras.

## 2. Usuarios

- **Compradores:** niños (con sus padres), familias y estudiantes. Entran sobre todo desde el celular, muchos desde enlaces de WhatsApp o redes. **[decisión mía]**
- **Dueño:** atiende él mismo desde su **celular Android** o desde la **PC de su tienda** **[cliente]**. A veces tiene ayuda, pero le cuesta la tecnología. Todo lo suyo debe ser lo más simple posible.
- **Ayudante del dueño:** puede atender pedidos con su propia cuenta de administrador. **[decisión mía]**, porque el dueño dijo que a veces tiene ayuda.
- **Visitantes del portafolio** (etapa 2): otros negocios que prueban la versión de demostración.

## 3. Objetivos, no objetivos y anti-objetivos

**Objetivos**
- Catálogo explorable sin cuenta, atractivo y rápido en PC y celular.
- Compra con cuenta obligatoria, pago por QR (Yape, Altoke, Yasta) y confirmación manual del dueño.
- Tres formas de entrega: recojo en tienda, envío dentro de La Paz y encomienda por bus a otros departamentos.
- Panel del dueño en el celular para revisar pagos, gestionar pedidos y cargar productos.
- Aviso inmediato al celular del dueño cuando entra un pedido.
- Estadísticas de ventas, pedidos y clientes.

**No objetivos (por ahora)**
- Pasarela de pago automática con tarjeta o verificación automática del QR. La confirmación es manual.
- Avisos automáticos por WhatsApp (la API de Meta es de pago). Quedan para cuando haya mensualidad.
- App en Play Store. El panel se instala como app web (PWA).
- Varias tiendas o sucursales, cupones, programa de puntos, reseñas.
- Inglés u otros idiomas.

**Anti-objetivos (sería un fracaso aunque "funcione")**
- Que el dueño necesite ayuda para revisar un pago o cargar un producto.
- Que se pierda un pago o un pedido, o que el dueño no se entere de uno nuevo.
- Que la web se vea como una plantilla genérica. Es portafolio.
- Que sea lenta o se vea mal en un celular de gama media con datos móviles.
- Que la versión demo toque o exponga datos reales de la tienda.
- Que haya costos mensuales sorpresa durante la prueba.

## 4. Restricciones

- **Plazo:** etapa 1 lista a mediados de noviembre de 2026 (alrededor del 15/11). Etapa 2 en diciembre.
- **Presupuesto casi cero** **[cliente: habrá pedidos reales esta Navidad, sin pagar hosting]**:
  - **Hosting en Netlify, plan gratis, desde el primer día.** El plan gratis permite uso comercial. Así no hay que mudar la web en plena temporada. **[decisión mía]** Netlify antes que Cloudflare porque su soporte de Next.js es más directo. Antes de empezar, el constructor debe confirmar los límites actuales del plan gratis de Netlify y anotar las funciones de Next.js que no conviene usar.
  - **Supabase, plan gratis:** 500 MB de base de datos y 1 GB de archivos. Se pausa tras 7 días sin uso, pero con tráfico diario no debería pasar. Igual se agrega una tarea programada que haga una consulta liviana cada día para mantenerlo activo.
  - **Copias de seguridad propias**, porque el plan gratis de Supabase no las ofrece descargables:
    - un volcado diario de la base de datos (`pg_dump`) con una tarea programada gratuita de GitHub Actions;
    - el volcado se guarda **cifrado**, porque contiene datos personales (CI, celulares, direcciones), y se conservan los últimos 30 días.
  - Las capturas de pago y las fotos de productos también entran en un respaldo, aunque sea semanal.
  - Dominio: al inicio, el subdominio gratis (`*.netlify.app`). Un dominio propio lo pagaría el cliente después.
- **Correo:** el SMTP que trae Supabase tiene un límite muy bajo de envíos por hora. Hay que configurar un SMTP propio gratis para los correos de las cuentas y de los pedidos (por ejemplo Resend, con su plan gratis). **[decisión mía]**
- **Localización:** Bolivia.
  - Moneda: bolivianos, formato `Bs 120`.
  - Documento de identidad: CI.
  - Departamentos: La Paz, Cochabamba, Santa Cruz, Oruro, Potosí, Chuquisaca, Tarija, Beni y Pando.
  - Todo el texto en español.
- **Catálogo:** alrededor de 40 a 50 productos al inicio, cargados por el dueño mismo desde su celular.
- **Accesibilidad:** contraste legible, botones de tamaño adecuado para el dedo, y respetar la preferencia del sistema de reducir animaciones (`prefers-reduced-motion`).

## 5. Lo decidido

### 5.1 Tecnología
- **Next.js (React) + Supabase.** **[cliente]** Diego lo eligió para aprender, en lugar de Laravel + Vue.
- TypeScript, Tailwind CSS, shadcn/ui y Motion para las animaciones. **[decisión mía]**
- Supabase cubre la base de datos (PostgreSQL), las cuentas, el almacenamiento de archivos y la seguridad por filas (RLS). **[decisión mía]**

### 5.2 Catálogo (público, sin cuenta)
- **Categorías iniciales** **[decisión mía, el dueño puede editarlas]**:
  - Estrategia (Catán, ajedrez…)
  - Clásicos en familia (Monopolio, Scrabble…)
  - Cartas (UNO…)
  - Casino
  - Destreza y canchitas (mini canchitas…)
  - Cubos y rompecabezas
- **Datos de cada producto:**
  - nombre, una o varias fotos, precio, descripción corta y categoría;
  - edad recomendada (mínima);
  - número de jugadores (mínimo y máximo);
  - stock;
  - etiquetas opcionales "Nuevo" y "Oferta", con precio anterior tachado.
- **Filtros:** categoría, precio, edad y número de jugadores, más un buscador por nombre.
- **Productos sin stock:** se muestran como "Agotado" y no se pueden agregar al carrito. No se ocultan.
- **Página de inicio:** sigue el boceto `estilo-b-v3-illimani.html`. Tiene esta estructura:
  - una portada con el cubo 3D y el paisaje;
  - las categorías;
  - "Los más pedidos";
  - una banda que explica el pago con QR.

### 5.3 Cuentas
- Se navega y se arma el carrito **sin cuenta**. La cuenta se pide recién al tocar "Comprar".
- El carrito no se pierde al iniciar sesión.
- Formas de entrar: correo y contraseña, o Google. **[decisión mía]**
- **Roles:** comprador y administrador. Los administradores se asignan a mano; no hay un registro público para administradores.

### 5.4 Flujo de compra
Está aprobado sobre el boceto `flujo-compra.html`. Los pasos son:

1. **Carrito:** resumen y total.
2. **Inicio de sesión**, si hace falta.
3. **Forma de entrega:**
   - **Recojo en tienda:** sin costo. Se muestran la dirección y el horario de la tienda.
   - **Envío dentro de La Paz** **[cliente]**: llega casi a toda la ciudad. En las zonas más alejadas no se lleva a domicilio: se queda en un **punto de encuentro** conocido (una plaza, una parada del teleférico, un instituto), a mitad de camino para que ninguno de los dos gaste de más.
     - El dueño mantiene una **lista de zonas**. Para cada zona indica si tiene envío "a domicilio" o "solo punto de encuentro". **[decisión mía]**
     - También mantiene una **lista de puntos de encuentro** con nombre y referencia. Por ejemplo, "Teleférico Rojo – estación Central" o "Plaza del Estudiante".
     - El comprador elige su zona. Si es "a domicilio", llena la dirección, la referencia y su celular. Si es "solo punto de encuentro", elige un punto de la lista o escribe uno que proponga. La hora se coordina por WhatsApp.
     - Hay dos tarifas que el dueño configura: domicilio y punto de encuentro. Pueden ser iguales, o la de punto de encuentro puede ser 0. **[decisión mía]**
   - **Encomienda por bus a otro departamento:** nombre completo de quien recoge, CI, celular, departamento y ciudad. El envío se manda a nombre del comprador. El costo del pasaje de la encomienda lo paga el comprador al recogerla ("por pagar"), y la web lo dice claramente. **[decisión mía, confirmar con el cliente]**
4. **Factura (opcional)** **[cliente]**: una casilla que dice "¿Necesitas factura?". Si la marca, pide NIT o CI y razón social. Esos datos se ven en el panel del pedido. La factura se emite fuera de la web. Es un "por si acaso": el cliente sí factura, pero no suele pedirse.
5. **Pago:**
   - Se muestran los QR que el dueño subió (Yape, Altoke, Yasta), el monto total y el **código del pedido**. Hay que pedir al comprador que ponga ese código en la glosa o concepto del pago.
   - El comprador sube la captura del pago.
   - **Sin captura no se envía el pedido.** **[decisión mía]**
6. **Confirmación:** se muestra la página del pedido con su estado.

**Estados del pedido:**
- *En revisión*: tiene captura y el dueño todavía no la revisó.
- *Pagado*: el dueño confirmó el pago.
- *Enviado*: para envíos y encomiendas.
- *Listo para recoger*: para recojo en tienda.
- *Entregado*.
- *Rechazado*: el dueño indica el motivo, y el comprador puede subir otra captura. Al hacerlo, el pedido vuelve a *En revisión*.
- *Cancelado*: lo puede hacer el dueño en cualquier momento. El comprador solo puede cancelar mientras su pedido esté *Rechazado*, porque en *En revisión* ya pagó.
- *Reembolsado*: cuando el dueño cancela un pedido ya pagado, lo marca así. La devolución del dinero la hace él por fuera, por Yape u otra billetera. No cuenta como venta en las estadísticas. **[decisión mía]**

**Capturas de pago** **[decisión mía]**
- Un pedido guarda **todas** las capturas que se suben, con su fecha, no solo la última.
- Si se rechaza por "monto incorrecto" (por ejemplo, pagó de menos), el comprador puede subir la captura del pago de la diferencia, y el dueño ve todas juntas para confirmar.

**Stock** **[decisión mía]**
- Se descuenta al enviar el pedido, para no vender dos veces el mismo último producto.
- Se devuelve si el pedido se cancela o se reembolsa.

**Vencimiento** **[decisión mía]**
- Un pedido *Rechazado* sin nueva captura en 48 horas se cancela solo, devuelve el stock y se avisa al comprador por correo.
- Los pedidos *En revisión* nunca vencen, pero el panel destaca los que llevan más de 24 horas sin atender.
- La tarea programada se hace con `pg_cron` de Supabase, para no depender del hosting.

**Encomiendas:** al marcarla como enviada, el dueño anota la agencia o empresa de buses y el número de guía. Opcionalmente adjunta una foto del comprobante. El comprador lo ve en su pedido.

**Seguridad:** las capturas de pago son **privadas**. Solo las ven el comprador dueño del pedido y los administradores.

### 5.5 Panel del dueño (PWA, pensado primero para el celular y también cómodo en la PC de la tienda)
- **Instalación:** se instala en la pantalla de inicio de Android y abre directo en "Pedidos". En la PC se usa desde el navegador (Chrome o Edge), que también permite instalarlo como app.
- **En pantallas grandes:** se aprovecha el ancho, por ejemplo con la lista de pedidos a la izquierda y el detalle a la derecha. Los botones siguen igual de claros.
- **Pantallas de pedidos:**
  - **Pedidos**, con pestañas *Por revisar*, *Por enviar o entregar* e *Historial*.
  - **Detalle del pedido:**
    - la captura en grande, con zoom;
    - el monto esperado y el código del pedido;
    - los datos de entrega;
    - botones grandes: **Confirmar pago** / **Rechazar** (pide el motivo, con opciones rápidas como "monto incorrecto" o "no se ve el pago").
  - **Marcar enviado / listo / entregado:** con la agencia y la guía cuando es encomienda.
- **Pantallas de productos:**
  - **Productos:** lista con buscador; desde ahí se crea, edita, oculta o elimina.
  - **Formulario de producto:** tan simple como publicar en redes sociales.
    - Las fotos se toman con la cámara o se eligen de la galería.
    - La web comprime las fotos sola antes de subirlas, para cuidar el límite de 1 GB.
    - El stock se edita con botones + / −.
  - **"Vendí en tienda"** **[decisión mía, a partir de lo que dijo el cliente]**:
    - **El problema:** el local vende los mismos productos en persona, y el dueño quiere que **todo** su inventario esté en la web para atraer gente.
    - **La solución:** junto a cada producto hay un botón rápido "Vendí en tienda" que pide la cantidad, descuenta el stock y registra una venta del local.
    - **En las estadísticas:** esas ventas se cuentan aparte, como "ventas en local", para no mezclarlas con las de la web.
- **Otras pantallas:**
  - **Estadísticas:** ver 5.7.
  - **Ajustes:**
    - nombre, logo y datos de la tienda (dirección, horario de recojo, número de WhatsApp);
    - las imágenes de los QR de cada billetera;
    - la tarifa de envío dentro de La Paz;
    - las categorías;
    - los administradores.
- **Estilo del panel:** usa los mismos colores y fuentes que la tienda, pero sobrio y sin efectos pesados. Prioridad absoluta: claridad y botones grandes.

### 5.6 Avisos
- **Al dueño y sus administradores:**
  - Una **notificación web (Web Push)** en el celular, y también en el navegador de la PC de la tienda si el dueño la activa ahí, apenas entra un pedido con captura, o cuando un comprador vuelve a subir una captura tras un rechazo. Ejemplo: *"Nuevo pedido #0231 · Bs 570 · Encomienda a Cochabamba"*. Al tocarla, se abre ese pedido.
  - Un correo de respaldo con lo mismo.
- **Al comprador:**
  - Correos de *pedido recibido*, *pago confirmado*, *pago rechazado (con motivo)* y *enviado / listo para recoger*.
  - Además, la página "Mis pedidos" con el estado de cada uno.
- **Contacto:**
  - Botón "Escribir a la tienda por WhatsApp" en el pedido y en la ficha de producto. Es un enlace `wa.me` con un mensaje ya escrito, por ejemplo "Hola, consulto por mi pedido #0231".
  - No hay WhatsApp automático.

### 5.7 Estadísticas
**Etapa 1:**
- Ventas (Bs y número de pedidos) de hoy, la semana y el mes.
- Pedidos por estado.
- Productos más vendidos.
- Clientes nuevos y recurrentes.
- Ventas por forma de entrega y por departamento.
- Productos con poco stock.

**Etapa 2:** gráficos de evolución, comparación entre meses y ticket promedio.

Solo cuentan como venta los pedidos pagados o en estados posteriores.

### 5.8 Diseño visual
Está aprobado: "Ludoteca cálida" con efectos modernos (boceto `estilo-b-v3-illimani.html`).

- **Paleta:**
  - crema `#f6efe3` / `#efe4d2`
  - tinta `#2b2118`
  - madera `#7a5230`
  - verde tablero `#1f4d3a` / `#2c6a50`
  - mostaza `#c9a227`
  - rojo `#c0392b`
  - Los colores del cubo, en tonos cálidos: rojo, crema, verde, mostaza, naranja y azul.
- **Tipografía:** Fraunces para los títulos y Inter para el texto.
- **Efectos:**
  - un cubo Rubik 3D girando sobre un tablero, con piezas de ajedrez flotando;
  - tarjetas de producto que se elevan y se inclinan en 3D al pasar el mouse, y muestran el botón de agregar. El botón de "favorito" del boceto **no va en la etapa 1**: no se muestra un botón que no hace nada. Una lista de favoritos queda como idea para más adelante. **[decisión mía]**
  - íconos de categoría con movimiento;
  - textos que aparecen suavemente al cargar;
  - una barra de menú translúcida.
  - En pantallas táctiles, los efectos de "pasar el mouse" no deben esconder nada importante.
- **Identidad paceña:**
  - de fondo de la portada, el **Illimani** al atardecer y las laderas de la ciudad;
  - **cabinas del teleférico** cruzando (roja, amarilla y verde).
  - Por ahora es una ilustración simplificada; **luego se reemplazará por fotos reales del Illimani** tratadas con la paleta cálida.
- **Rendimiento:** los efectos no deben volver lenta la web en un celular de gama media. Con `prefers-reduced-motion`, todo queda estático.
- **Datos pendientes del cliente:**
  - El **nombre, el logo y el lema** los pone el cliente. "Ludiq" es solo un nombre de relleno.
  - Lema sugerido: "juegos de mesa para pensar y compartir".

### 5.9 Datos de prueba
- Se cargan unos 15 a 20 productos simulados, repartidos entre todas las categorías, con fotos de relleno. Se usan para desarrollar, para mostrarle al cliente y como base de la demo.
- Antes de que el cliente cargue lo real, hay que poder borrarlos con facilidad.

### 5.10 Versión demo para el portafolio (etapa 2)
- Una copia de la web con datos de ejemplo, donde cualquiera puede entrar como "dueño de prueba" y "comprador de prueba" con un botón, sin registrarse.
- Debe estar **totalmente separada** de los datos reales de la tienda y poder restaurarse a su estado inicial (por ejemplo, cada noche).
- No debe enviar avisos reales a nadie.

### 5.11 Control de versiones **[cliente]**
- Repositorio en **GitHub**, privado al inicio, en la cuenta de Diego. **[decisión mía: GitHub antes que GitLab]** Netlify se conecta directo, GitHub Actions hace los respaldos gratis y queda visible para el portafolio. Se puede volver público más adelante.
- **Ramas:**
  - `main` es lo que está publicado. Netlify despliega solo cada vez que se actualiza.
  - Cada función se hace en su propia rama (`feat/...`, `fix/...`) y entra a `main` con un Pull Request.
  - Netlify genera una vista previa de cada Pull Request, para revisarla antes de publicar.
- **Secretos:** las claves de Supabase, de correo y de Web Push **nunca** se suben al repositorio. Van como variables de entorno en Netlify y en GitHub Actions.

## 6. Etapas

**Etapa 1 — mediados de noviembre de 2026**
- Todo lo de 5.1 a 5.6.
- Las estadísticas de la etapa 1 (5.7).
- El diseño visual (5.8) con la ilustración del Illimani.
- Los datos de prueba (5.9).
- Publicada en Netlify, lista para vender de verdad.
- Repositorio en GitHub con despliegue automático (ver 5.11).

**Orden de prioridad dentro de la etapa 1, por si no alcanza el tiempo** **[decisión mía]**
1. **Imprescindible:** el circuito completo de venta.
   - En la tienda: catálogo con filtros, carrito, cuentas con correo, entrega y pago con captura.
   - En el panel: pedidos (confirmar, rechazar, enviar), productos con foto y ajustes de QR y tienda.
   - El aviso Web Push al dueño.
2. **Importante:**
   - el diseño visual completo con los efectos;
   - los correos al comprador;
   - el vencimiento automático de pedidos.
3. **Puede pasar a diciembre sin bloquear la venta:**
   - entrar con Google;
   - las estadísticas;
   - el buscador por nombre;
   - las piezas flotantes y el teleférico animado (la portada se ve bien sin ellos).

**Etapa 2 — diciembre de 2026**
- Las estadísticas de la etapa 2.
- La demo de portafolio (5.10).
- Las fotos reales del Illimani.
- Ajustes según el uso real del cliente.
- Dominio propio, cuando el cliente lo pague.

## 7. Lo que queda a criterio del constructor
- Cómo se estructuran el proyecto, las tablas y las políticas de seguridad (RLS), mientras se cumpla lo de arriba.
- Cómo se implementa el carrito sin cuenta y cómo se une con el de la cuenta al iniciar sesión.
- Si el cubo 3D se hace en CSS (como en el boceto, más liviano) o con Three.js, siempre que cumpla el rendimiento en celular.
- La herramienta de correo y la librería de Web Push.
- La forma exacta de numerar los pedidos (por ejemplo, `#0231`).
- Cómo se implementa la separación de la demo (otro proyecto de Supabase, otro esquema, etc.).

## 8. Datos que hay que pedirle al cliente
- Nombre de la tienda, logo y, si tiene, lema y colores propios.
- Imágenes de sus QR de Yape, Altoke y Yasta.
- Número de WhatsApp, dirección y horario de recojo.
- Tarifas de envío dentro de La Paz (a domicilio y en punto de encuentro), la lista de zonas con o sin domicilio, y sus puntos de encuentro habituales.
- Confirmar que la encomienda se paga al recoger ("por pagar").
- Las fotos y los datos de sus 40 a 50 productos (los carga él mismo).
