import type { CatalogFilters, CatalogSort } from "./types";

type SearchParams = Record<string, string | string[] | undefined>;

const SORTS: readonly CatalogSort[] = ["destacados", "precio_asc", "precio_desc", "nuevos"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function intInRange(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

/** Convierte los parámetros de la URL en filtros válidos; lo inválido se ignora. */
export function parseCatalogFilters(sp: SearchParams): CatalogFilters {
  const filters: CatalogFilters = { orden: "destacados" };

  const orden = first(sp.orden);
  if (orden && (SORTS as readonly string[]).includes(orden)) filters.orden = orden as CatalogSort;

  const categoria = first(sp.categoria)?.trim();
  if (categoria) filters.categoria = categoria;

  const q = first(sp.q)?.trim();
  if (q) filters.q = q;

  let precioMin = intInRange(first(sp.precio_min), 0, 1_000_000);
  let precioMax = intInRange(first(sp.precio_max), 0, 1_000_000);
  if (precioMin !== undefined && precioMax !== undefined && precioMin > precioMax) {
    [precioMin, precioMax] = [precioMax, precioMin];
  }
  if (precioMin !== undefined) filters.precioMin = precioMin;
  if (precioMax !== undefined) filters.precioMax = precioMax;

  const edad = intInRange(first(sp.edad), 0, 99);
  if (edad !== undefined) filters.edad = edad;

  const jugadores = intInRange(first(sp.jugadores), 1, 20);
  if (jugadores !== undefined) filters.jugadores = jugadores;

  if (first(sp.ofertas) === "1") filters.ofertas = true;

  return filters;
}
