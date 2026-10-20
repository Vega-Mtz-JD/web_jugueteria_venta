// Versiones cacheadas de las consultas del catálogo, para usar en páginas y layouts.
// queries.ts queda sin caché para poder probarlo fuera de Next.
// El panel del dueño invalida esta etiqueta con invalidateCatalog() (invalidate.ts) al editar.
import { cacheLife, cacheTag } from "next/cache";
import * as queries from "./queries";
import type { CatalogFilters } from "./types";

export const CATALOG_TAG = "catalogo";

export async function getStoreSettings() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return queries.getStoreSettings();
}

export async function listCategories() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return queries.listCategories();
}

export async function listProducts(filters: CatalogFilters, limit?: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return queries.listProducts(filters, limit);
}

export async function getProductBySlug(slug: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  return queries.getProductBySlug(slug);
}
