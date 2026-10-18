// Pruebas contra Supabase local con los datos de supabase/seed.sql.
// Correr con: npx supabase start && npm run test:int
import { describe, expect, it } from "vitest";
import { getProductBySlug, getStoreSettings, listCategories, listProducts } from "./queries";

describe("listCategories", () => {
  it("devuelve las 6 categorías en el orden del seed", async () => {
    const cats = await listCategories();
    expect(cats.map((c) => c.slug)).toEqual([
      "estrategia",
      "clasicos-familia",
      "cartas",
      "casino",
      "destreza-canchitas",
      "cubos-rompecabezas",
    ]);
  });
});

describe("listProducts", () => {
  it("no incluye inactivos y deja los agotados al final", async () => {
    const products = await listProducts({ orden: "destacados" });
    expect(products).toHaveLength(17);
    expect(products.some((p) => p.slug === "risk")).toBe(false);
    const last = products[products.length - 1];
    expect(last.slug).toBe("exploding-kittens");
    expect(last.inStock).toBe(false);
  });

  it("busca sin importar mayúsculas ni tildes", async () => {
    for (const q of ["CATAN", "catán"]) {
      const products = await listProducts({ q, orden: "destacados" });
      expect(products.map((p) => p.name)).toContain("Catán");
    }
  });

  it("búsquedas con símbolos no fallan", async () => {
    await expect(listProducts({ q: "50%", orden: "destacados" })).resolves.toEqual([]);
    await expect(listProducts({ q: "o'neil", orden: "destacados" })).resolves.toEqual([]);
  });

  it("una categoría inexistente devuelve una lista vacía", async () => {
    await expect(listProducts({ categoria: "no-existe", orden: "destacados" })).resolves.toEqual([]);
  });

  it("filtra por categoría", async () => {
    const products = await listProducts({ categoria: "cartas", orden: "destacados" });
    expect(products.length).toBe(3);
    expect(products.every((p) => p.categoryName === "Cartas")).toBe(true);
  });

  it("jugadores=1 excluye juegos que necesitan 2 o más", async () => {
    const products = await listProducts({ jugadores: 1, orden: "destacados" });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.minPlayers === null || p.minPlayers <= 1)).toBe(true);
  });

  it("combina edad y jugadores", async () => {
    const products = await listProducts({ edad: 6, jugadores: 2, orden: "destacados" });
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.minAge === null || p.minAge <= 6).toBe(true);
      expect(p.minPlayers === null || p.minPlayers <= 2).toBe(true);
      expect(p.maxPlayers === null || p.maxPlayers >= 2).toBe(true);
    }
  });

  it("filtra por rango de precio en bolivianos", async () => {
    const products = await listProducts({ precioMin: 100, precioMax: 200, orden: "destacados" });
    expect(products.length).toBeGreaterThan(0);
    expect(products.every((p) => p.priceCents >= 10000 && p.priceCents <= 20000)).toBe(true);
  });

  it("ofertas solo trae productos con precio anterior", async () => {
    const products = await listProducts({ ofertas: true, orden: "destacados" });
    expect(products.map((p) => p.slug)).toEqual(["scrabble-original"]);
  });

  it("ordena por precio", async () => {
    const asc = await listProducts({ orden: "precio_asc" });
    const inStock = asc.filter((p) => p.inStock).map((p) => p.priceCents);
    expect(inStock).toEqual([...inStock].sort((a, b) => a - b));
  });

  it("el producto sin fotos usa la imagen de relleno", async () => {
    const products = await listProducts({ q: "4x4", orden: "destacados" });
    expect(products[0].imageUrl).toBe("/samples/placeholder.svg");
  });

  it("respeta el límite", async () => {
    await expect(listProducts({ orden: "destacados" }, 8)).resolves.toHaveLength(8);
  });
});

describe("getProductBySlug", () => {
  it("devuelve el detalle de un producto activo", async () => {
    const p = await getProductBySlug("catan");
    expect(p?.name).toBe("Catán");
    expect(p?.categorySlug).toBe("estrategia");
    expect(p?.images[0].url).toBe("/samples/catan.svg");
    expect(p?.stock).toBe(5);
  });

  it("devuelve null para inactivos o inexistentes", async () => {
    await expect(getProductBySlug("risk")).resolves.toBeNull();
    await expect(getProductBySlug("nada")).resolves.toBeNull();
  });
});

describe("getStoreSettings", () => {
  it("lee los ajustes de la tienda", async () => {
    const s = await getStoreSettings();
    expect(s.storeName).toBe("Ludiq");
    expect(s.whatsappPhone).toBe("+59170000000");
  });
});
