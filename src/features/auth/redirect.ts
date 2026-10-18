/** Ruta de retorno después de ingresar: solo rutas internas ("/algo"), nunca otro sitio. */
export function safeRedirectPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/** Rutas que exigen sesión. */
export function isProtectedPath(pathname: string): boolean {
  return pathname === "/checkout" || pathname === "/pedidos" || pathname.startsWith("/pedidos/");
}
