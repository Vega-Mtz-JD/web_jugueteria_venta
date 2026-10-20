# Hoja de ruta de planes — Tienda de juegos de mesa

Spec: `docs/superpowers/specs/2026-10-18-tienda-juegos-design.md`

La etapa 1 del spec se divide en cinco planes. Cada uno deja software funcionando, probado y desplegado; el siguiente se escribe cuando el anterior está terminado, con lo aprendido.

| # | Plan | Cubre del spec | Entrega |
|---|------|----------------|---------|
| 1 | Fundaciones y catálogo público | 4, 5.1, 5.2, 5.8, 5.9, 5.11 | Tienda navegable (inicio, catálogo con filtros, ficha) publicada en Netlify con datos de prueba y CI |
| 2 | Cuentas, carrito y compra | 5.3, 5.4 (incluye factura, zonas y puntos de encuentro, capturas, estados, stock, vencimiento) | Un comprador puede pedir y pagar con QR; los pedidos quedan en la base |
| 3A | Panel para vender (`2026-10-20-plan-3a-panel-para-vender.md`) | spec del panel §5.1–§5.6 | El dueño y sus hijos atienden pedidos, productos, stock y ajustes desde `/panel` |
| 3B | Inventario y proveedores | spec del panel §5.7 | Compras que suben stock, costos y ganancia |
| 4 | Avisos y respaldos (`2026-10-20-plan-4-avisos-y-respaldos.md`) | 5.6, respaldos y keep-alive de 4 | Web Push al dueño, correos al comprador, pg_dump diario cifrado |
| 5 | Dashboard con gráficos | spec del panel §5.8 | Ventas, inventario, ganancia y clientes en gráficos |

Prioridad si falta tiempo (spec §6): los planes 1–3 más el Web Push del plan 4 son el mínimo para vender. Google login (plan 2), estadísticas (plan 5), buscador, piezas flotantes y teleférico pueden pasar a diciembre.

Etapa 2 (diciembre): estadísticas avanzadas, demo de portafolio, fotos reales del Illimani — se planifican aparte.
