/** URL pública del sitio (sin barra final), para sitemap, robots y metadatos. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
