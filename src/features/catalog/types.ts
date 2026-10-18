export type CatalogSort = "destacados" | "precio_asc" | "precio_desc" | "nuevos";

/** Filtros del catálogo; los precios están en bolivianos (no en centavos). */
export type CatalogFilters = {
  categoria?: string;
  q?: string;
  precioMin?: number;
  precioMax?: number;
  edad?: number;
  jugadores?: number;
  ofertas?: true;
  orden: CatalogSort;
};

export type Category = { id: string; name: string; slug: string };

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  priceCents: number;
  compareAtCents: number | null;
  minAge: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  inStock: boolean;
  isNew: boolean;
  imageUrl: string;
};

export type ProductDetail = ProductCardData & {
  description: string | null;
  stock: number;
  images: { url: string; alt: string }[];
  categorySlug: string;
};

export type StoreSettings = {
  storeName: string;
  tagline: string | null;
  whatsappPhone: string | null;
  address: string | null;
  pickupHours: string | null;
};
