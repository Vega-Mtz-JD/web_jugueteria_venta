# Etapa 2 — Fotos de la tienda y «Visítanos»: documento de diseño

**Fecha:** 21/10/2026
**Contexto:** `docs/PROYECTO.md`. En producción: planes 1, 2, 3A, 4, 3B y 5. Es la primera parte de la Etapa 2; el dominio propio, las estadísticas avanzadas y la demo de portafolio quedan para después **[cliente]**. Las fotos de La Paz del carrusel **cubren** lo que la Etapa 2 llamaba «fotos reales del Illimani»: el Illimani dibujado de la portada se queda **[cliente]**.

Cómo leer las marcas:
- **[cliente]**: lo dijo Diego en nombre del dueño.
- **[decisión mía]**: lo propuse yo; se puede cambiar.
- **[constructor]**: queda a criterio de quien construya.

---

## 1. Intención y por qué

Quien entra por primera vez a la web tiene que ver que **Ludiq es una tienda real y confiable en La Paz** **[cliente]**. Hoy, cuando alguien duda por WhatsApp, el dueño le manda **la ubicación y fotos de la tienda** **[cliente]**. La web debe hacer lo mismo sola.

Todavía no hay fotos: Diego quiere **dejar todo listo** para que, cuando las tengan, solo haya que subirlas o cambiarlas **[cliente]**. Las sube **el dueño mismo desde el panel**, sin pasar por Diego ni publicar una versión nueva **[cliente]**. Cada publicación gasta 15 de los 300 créditos mensuales de Netlify.

Las fotos son del local y de **La Paz tomadas por el propio dueño** **[cliente]**, cada una con **una frase corta** **[cliente]**.

**Lo que haría que se arrepienta: que la página cargue lenta en el celular [cliente].**

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos:**
- Un carrusel de fotos tipo **postal** en el inicio de la portada, en el lugar del cubo 3D (boceto C elegido **[cliente]**).
- Una sección **«Visítanos»** más abajo: dirección, horario, mapa, «Cómo llegar» y WhatsApp **[cliente]**.
- En el panel, una parte para **subir, ordenar, poner la frase y quitar** las fotos.

**No objetivos:**
- El dominio propio (después de hablar con el dueño **[cliente]**).
- Galería o página aparte de fotos; videos; recorrido 360°.
- Fotos de terceros o de bancos de imágenes.

**Anti-objetivos:**
- **Una portada lenta en el celular [cliente].**
- Una portada vacía o rota mientras no haya fotos.
- Un carrusel que se mueve solo para alguien que pidió menos animaciones.
- Tener que publicar una versión nueva para cambiar una foto.

## 3. Usuarios y dispositivos

- **Compradores:** casi todos en el celular, muchos con datos móviles.
- **Quien sube las fotos:** el dueño (o sus hijos), administradores, desde su Android, con las mismas facilidades que las fotos de productos (plan 3A).

## 4. Lo que se construye

### 4.1 La postal (inicio de la portada)

- Se quedan el título, los botones, la línea de confianza y el **Illimani dibujado**. **El cubo 3D se reemplaza** por un **carrusel con marco de postal**: borde blanco, sombra y una leve inclinación **[cliente, boceto C]**.
- Cada foto muestra **su frase corta** (en la postal o justo debajo **[constructor]**). La frase también es el texto alternativo de la imagen.
- **Puntitos** para ir a una foto, y se puede **deslizar con el dedo** **[decisión mía]**.
- **Pasa sola cada 5 segundos** **[decisión mía]**, salvo si:
  - la persona tiene activado "reducir movimiento";
  - pausó las animaciones con el botón que ya existe en la portada;
  - está tocando o pasando el mouse sobre la postal.
- Debajo de la postal: **«📍 <zona>, La Paz · Cómo llegar»**. «Cómo llegar» abre el enlace de Google Maps (§4.3).
- **Sin fotos:** se ve el **cubo 3D de siempre**, como hoy **[decisión mía]**. Con una sola foto: la postal sin puntitos y sin movimiento.

### 4.2 «Visítanos» (más abajo en la portada)

Una sección con título **«Visítanos en La Paz»**, debajo de los productos destacados **[decisión mía]**:
- **Dirección** y **horario**: salen de lo que ya está en Ajustes (`store_settings.address` y `pickup_hours`), así no se escriben dos veces.
- **Botones grandes:**
  - **«Cómo llegar»**: abre el enlace de Google Maps;
  - **«WhatsApp»**: usa el número de Ajustes.
- **Mapa:** para que la portada no cargue lenta, **no se carga al abrir la página**. Hay un recuadro con **«Ver el mapa»**, y al tocarlo se carga el mapa de Google con el **pin exacto en las coordenadas** de Ajustes (`https://www.google.com/maps?q=<lat>,<lng>&z=17&output=embed`, sin clave) **[cliente: coordenadas; decisión mía: cargar al tocar]**. Sin coordenadas no se muestra el recuadro del mapa (los botones sí).
- Si no hay dirección en Ajustes, la sección no aparece. Si no hay enlace de Maps, «Cómo llegar» busca la dirección en Google Maps **[decisión mía]**.

### 4.3 Panel: «Fotos de la tienda» y datos de ubicación

En **Ajustes**, una parte nueva **«Fotos de la tienda»** **[decisión mía, por estar junto a los datos de la tienda]**:
- **Subir** una o varias fotos. Se **comprimen en el celular** antes de subirse, igual que las de productos: WebP, lado máximo 1600 px. Se reutiliza `compressProductPhoto` o una variante **[constructor]**.
- **La frase** de cada foto: obligatoria, hasta 80 caracteres **[decisión mía]**.
- **Ordenar** (subir o bajar) y **quitar**, con confirmación.
- **Hasta 8 fotos** **[decisión mía]**: más no suma confianza y pesa más.

En los datos de la tienda (Ajustes), dos campos nuevos **[decisión mía]**:
- **Zona**, por ejemplo «Sopocachi», para la línea bajo la postal.
- **Enlace de Google Maps**: el mismo que el dueño manda por WhatsApp. Se valida que sea de Google Maps (`google.com/maps`, `maps.google.com`, `maps.app.goo.gl` o `goo.gl/maps`).
- **Coordenadas** **[cliente]**: el dueño mantiene el dedo sobre la tienda en Google Maps, copia los números (por ejemplo `-16.5103, -68.1267`) y los pega. Se acepta `lat, lng` con punto decimal y espacios opcionales. Se valida que caigan en Bolivia (latitud entre −23 y −9, longitud entre −70 y −57) y se guardan como dos números. Con un texto inválido se muestra: `Pega las coordenadas como aparecen en Google Maps, por ejemplo -16.5103, -68.1267`. Debajo del campo va una ayuda de una línea que explica cómo copiarlas.

Al guardar cualquier cosa de esta parte, la portada se actualiza sola (`invalidateCatalog()`), como pasa hoy con los ajustes.

## 5. Rapidez (la regla que no se rompe)

- **Solo la primera foto se carga al abrir la página.** Las demás se cargan cuando van a mostrarse (o cuando el navegador esté libre) **[constructor el mecanismo]**.
- Las fotos se sirven **del tamaño de la postal**, no a 1600 px, si el mecanismo de imágenes del proyecto lo permite. Si no, la compresión del celular es el límite **[constructor]**.
- **El mapa nunca se carga si no se toca «Ver el mapa».**
- **El carrusel no agrega librerías:** es un componente propio, liviano, con CSS (`scroll-snap`) y lo mínimo de JavaScript **[decisión mía]**.
- **La portada sigue en caché**, como hoy (`"use cache"` con el tag del catálogo): las fotos y los datos se leen en el servidor y no hay una llamada extra desde el celular.
- **Medición:**
  - con fotos, la portada en el celular no debe empeorar visiblemente frente a la de hoy;
  - **Lighthouse móvil**: rendimiento ≥ 85 con 8 fotos cargadas **[decisión mía]**;
  - el reacomodo de la página (CLS) no sube, porque la postal tiene tamaño fijo.
- **Dónde se mide [decisión mía]:**
  - En local, con **fotos de prueba generadas** (8 imágenes de 1600 px). Solo existen para las pruebas y nunca se suben a la nube. No son «fotos de terceros» para la tienda.
  - La vista previa de Netlify usa la base de producción. Diego hace el `db push` antes de probarla, como siempre, y la prueba subiendo una foto propia desde el panel. Si no quiere que esa foto quede en la tienda al fusionar, la quita desde el mismo panel.

## 6. Restricciones

- Todas las reglas de `CLAUDE.md`:
  - Next 16 con Cache Components;
  - datos públicos con `"use cache"` en `src/features/catalog/cached.ts`;
  - RLS en toda tabla nueva: lectura pública de las fotos, escritura solo de admin;
  - TDD;
  - interfaz en español.
- **Archivos:** un bucket público (o una carpeta del bucket público que ya existe para la tienda **[constructor]**), con tipos de imagen permitidos y **sin SVG**, igual que la corrección del plan 2.
- **Supabase gratis, 1 GB:** 8 fotos comprimidas son unos pocos MB. Al quitar una foto también se borra su archivo **[decisión mía]**.
- **Accesibilidad:**
  - el carrusel se maneja con el teclado (los puntitos son botones);
  - anuncia "foto N de M";
  - respeta "reducir movimiento" y el botón de pausa existente.
- **Créditos de Netlify:** una sola fusión a `main` para esta parte.
- **Las e2e de la tienda cuentan productos del seed;** las nuevas no deben cambiar esos conteos.

## 7. Lo que queda al constructor

- Nombre de la tabla de fotos y si el orden se guarda como número o como lista.
- Dónde exactamente va la frase en la postal (encima o debajo de la foto).
- Cómo se cargan las fotos siguientes sin pesar al abrir.
- Si la zona se escribe aparte o se toma de la dirección.
- Si las coordenadas se guardan en `store_settings` (dos columnas `numeric`) o en otra tabla.
- Cómo se ve «Visítanos» en la PC (dos columnas con fotos y datos, por ejemplo).
