import { productImageUrl } from "@/lib/images";
import { bsToCents } from "@/lib/money";
import { escapeLike, normalizeSearch } from "@/lib/search";
import { supabaseEnv } from "@/lib/supabase/env";
import { createPublicSupabase } from "@/lib/supabase/public";
import { settingsFromRow } from "./filters";
import type { CatalogFilters, Category, ProductCardData, ProductDetail, StoreSettings } from "./types";

const PRODUCT_COLUMNS =
  "id, slug, name, description, price_cents, compare_at_cents, min_age, min_players, max_players, stock, is_new, created_at, categories!inner(name, slug), product_images(path, alt, sort_order)";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  compare_at_cents: number | null;
  min_age: number | null;
  min_players: number | null;
  max_players: number | null;
  stock: number;
  is_new: boolean;
  categories: { name: string; slug: string };
  product_images: { path: string; alt: string | null; sort_order: number }[];
};

function sortedImages(row: ProductRow) {
  return [...row.product_images].sort((a, b) => a.sort_order - b.sort_order);
}

function toCard(row: ProductRow, supabaseUrl: string): ProductCardData {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    categoryName: row.categories.name,
    priceCents: row.price_cents,
    compareAtCents: row.compare_at_cents,
    minAge: row.min_age,
    minPlayers: row.min_players,
    maxPlayers: row.max_players,
    inStock: row.stock > 0,
    isNew: row.is_new,
    imageUrl: productImageUrl(sortedImages(row)[0]?.path ?? null, supabaseUrl),
  };
}

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await createPublicSupabase()
    .from("categories")
    .select("id, name, slug")
    .order("sort_order");
  if (error) throw error;
  return data;
}

export async function listProducts(f: CatalogFilters, limit?: number): Promise<ProductCardData[]> {
  let query = createPublicSupabase().from("products").select(PRODUCT_COLUMNS).eq("is_active", true);

  if (f.categoria) query = query.eq("categories.slug", f.categoria);
  if (f.q) {
    // Cada palabra debe aparecer, en cualquier orden: "ajedrez madera" encuentra "Ajedrez de madera".
    for (const word of normalizeSearch(f.q).split(" ").filter(Boolean)) {
      query = query.ilike("search_text", `%${escapeLike(word)}%`);
    }
  }
  if (f.precioMin !== undefined) query = query.gte("price_cents", bsToCents(f.precioMin));
  if (f.precioMax !== undefined) query = query.lte("price_cents", bsToCents(f.precioMax));
  if (f.ofertas) query = query.not("compare_at_cents", "is", null);
  if (f.edad !== undefined) query = query.or(`min_age.is.null,min_age.lte.${f.edad}`);
  if (f.jugadores !== undefined) {
    const n = f.jugadores;
    query = query.or(
      `and(min_players.is.null,max_players.is.null),and(min_players.is.null,max_players.gte.${n}),` +
        `and(min_players.lte.${n},max_players.is.null),and(min_players.lte.${n},max_players.gte.${n})`,
    );
  }

  switch (f.orden) {
    case "precio_asc":
      query = query.order("price_cents", { ascending: true });
      break;
    case "precio_desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "nuevos":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("is_new", { ascending: false }).order("created_at", { ascending: false });
  }
  query = query.order("name");

  const { data, error } = await query.returns<ProductRow[]>();
  if (error) throw error;

  const { url } = supabaseEnv();
  // Los agotados van al final sin alterar el orden elegido (sort es estable).
  const cards = data.map((row) => toCard(row, url)).sort((a, b) => Number(b.inStock) - Number(a.inStock));
  return limit === undefined ? cards : cards.slice(0, limit);
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const { data, error } = await createPublicSupabase()
    .from("products")
    .select(PRODUCT_COLUMNS)
    .eq("is_active", true)
    .eq("slug", slug)
    .returns<ProductRow[]>()
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { url } = supabaseEnv();
  return {
    ...toCard(data, url),
    description: data.description,
    stock: data.stock,
    categorySlug: data.categories.slug,
    images: sortedImages(data).map((img) => ({ url: productImageUrl(img.path, url), alt: img.alt ?? data.name })),
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const { data, error } = await createPublicSupabase()
    .from("store_settings")
    .select("store_name, tagline, whatsapp_phone, address, pickup_hours")
    .maybeSingle();
  if (error) throw error;
  return settingsFromRow(data);
}
