import { describe, expect, it } from "vitest";
import { productInputSchema } from "./product-schema";

const base = {
  name: "Juego de prueba",
  categoryId: "00000000-0000-4000-8000-000000000001",
  priceBs: "120",
  compareAtBs: "",
  minAge: "8",
  minPlayers: "2",
  maxPlayers: "4",
  stock: "3",
  description: "",
  isNew: false,
  isActive: true,
};

function errors(input: Record<string, unknown>) {
  const r = productInputSchema.safeParse({ ...base, ...input });
  return r.success ? [] : r.error.issues.map((i) => i.message);
}

describe("productInputSchema", () => {
  it("convierte Bs a centavos y vacíos a null", () => {
    const r = productInputSchema.parse({ ...base, priceBs: "120,50" });
    expect(r).toMatchObject({ priceCents: 12050, compareAtCents: null, minAge: 8, minPlayers: 2, maxPlayers: 4, stock: 3, description: null });
  });
  it("el precio anterior debe ser mayor", () => {
    expect(errors({ compareAtBs: "120" })).toContain("El precio anterior debe ser mayor que el precio");
    expect(errors({ compareAtBs: "150" })).toEqual([]);
  });
  it("máximo de jugadores no menor que el mínimo", () => {
    expect(errors({ minPlayers: "4", maxPlayers: "2" })).toContain("El máximo de jugadores debe ser igual o mayor que el mínimo");
  });
  it("valida nombre, precio, categoría, edad y stock", () => {
    expect(errors({ name: "ab" })).toContain("El nombre debe tener entre 3 y 120 letras");
    expect(errors({ priceBs: "0" })).toContain("Escribe un precio mayor que 0");
    expect(errors({ priceBs: "abc" })).toContain("Escribe un precio mayor que 0");
    expect(errors({ categoryId: "" })).toContain("Elige una categoría");
    expect(errors({ minAge: "120" })).toContain("La edad mínima debe estar entre 0 y 99");
    expect(errors({ stock: "-1" })).toContain("El stock debe ser un número entero, 0 o más");
  });
  it("el stock es opcional (al editar no se envía)", () => {
    expect(productInputSchema.parse({ ...base, stock: undefined }).stock).toBeNull();
  });
});

describe("precios escritos de varias formas", () => {
  it.each([
    ["1.250,50", 125050],
    ["1250.5", 125050],
    ["1.250", 125000],
    ["85", 8500],
  ])("%s → %i centavos", (priceBs, cents) => {
    expect(productInputSchema.parse({ ...base, priceBs }).priceCents).toBe(cents);
  });
});

describe("bsTextToCents y centsToBsText", () => {
  it("van y vuelven", async () => {
    const { bsTextToCents, centsToBsText } = await import("./product-schema");
    expect(bsTextToCents("85,50")).toBe(8550);
    expect(bsTextToCents("abc")).toBeNull();
    expect(bsTextToCents("-1")).toBeNull();
    expect(centsToBsText(10000)).toBe("100");
    expect(centsToBsText(8550)).toBe("85,50");
    expect(centsToBsText(null)).toBe("");
  });
});

describe("productSaveError", () => {
  it("la base no deja mostrar un producto con precio 0", async () => {
    const { productSaveError } = await import("../admin/errors");
    expect(productSaveError({ code: "23514", message: 'violates check constraint "products_visible_price"' })).toBe("Pon un precio de venta antes de mostrar el producto");
    expect(productSaveError({ code: "XX000", message: "otro" })).toBe("No pudimos guardar el producto. Vuelve a intentarlo.");
  });
});
