/** Mensaje para el admin a partir del error de una función admin_* (P0001 se muestra tal cual). */
export function adminErrorMessage(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Solo un administrador puede hacer esto";
  return fallback;
}

/** Error al guardar un producto: la base no deja mostrar uno con precio 0 (juego creado desde una compra). */
export function productSaveError(error: { code?: string; message: string }): string {
  if (error.code === "23514" && error.message.includes("products_visible_price")) return "Pon un precio de venta antes de mostrar el producto";
  return "No pudimos guardar el producto. Vuelve a intentarlo.";
}
