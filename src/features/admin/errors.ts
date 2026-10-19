/** Mensaje para el admin a partir del error de una función admin_* (P0001 se muestra tal cual). */
export function adminErrorMessage(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "P0001") return error.message;
  if (error.code === "42501") return "Solo un administrador puede hacer esto";
  return fallback;
}
