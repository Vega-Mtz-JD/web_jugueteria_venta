import { describe, expect, it } from "vitest";
import { productImageUrl } from "./images";

const SUPABASE_URL = "https://x.supabase.co";

describe("productImageUrl", () => {
  it("usa la imagen de relleno si no hay foto", () => {
    expect(productImageUrl(null, SUPABASE_URL)).toBe("/samples/placeholder.svg");
  });

  it("deja tal cual las imágenes locales de /public", () => {
    expect(productImageUrl("/samples/catan.svg", SUPABASE_URL)).toBe("/samples/catan.svg");
  });

  it("arma la URL pública del bucket de Supabase", () => {
    expect(productImageUrl("p/1.webp", SUPABASE_URL)).toBe(
      "https://x.supabase.co/storage/v1/object/public/product-images/p/1.webp",
    );
  });
});
