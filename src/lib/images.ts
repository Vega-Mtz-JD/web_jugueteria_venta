export const PLACEHOLDER_IMAGE = "/samples/placeholder.svg";

// Las rutas que empiezan con "/" son archivos de /public (productos de prueba);
// el resto son objetos del bucket público "product-images" de Supabase Storage.
export function productImageUrl(path: string | null, supabaseUrl: string): string {
  if (path === null) return PLACEHOLDER_IMAGE;
  if (path.startsWith("/")) return path;
  return `${supabaseUrl}/storage/v1/object/public/product-images/${path}`;
}
