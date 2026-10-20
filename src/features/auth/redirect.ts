/** Ruta de retorno después de ingresar: solo rutas internas ("/algo"), nunca otro sitio. */
export function safeRedirectPath(value: string | null | undefined): string {
  // Sin caracteres de control ni barras invertidas: los navegadores los ignoran o los
  // convierten, y "/\t/evil.com" terminaría en otro sitio.
  if (!value || !value.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  const url = new URL(value, "http://ludiq.local");
  if (url.origin !== "http://ludiq.local") return "/";
  return url.pathname + url.search + url.hash;
}

/** Rutas que exigen sesión. */
export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/checkout" ||
    pathname === "/pedidos" ||
    pathname.startsWith("/pedidos/") ||
    pathname === "/panel" ||
    pathname.startsWith("/panel/")
  );
}
