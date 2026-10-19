import { describe, expect, it } from "vitest";
import { nextFreeSlug, slugify } from "./slug";

describe("slugify", () => {
  it("quita tildes y signos, y usa guiones", () => {
    expect(slugify("Catán: Ciudades y Caballeros")).toBe("catan-ciudades-y-caballeros");
  });
  it("ñ se vuelve n y los espacios dobles un solo guion", () => {
    expect(slugify("  Año   Nuevo  ¡Piñata! ")).toBe("ano-nuevo-pinata");
  });
  it("sin letras usa 'producto'", () => {
    expect(slugify("¿¡!?")).toBe("producto");
  });
  it("no pasa de 80 caracteres ni termina en guion", () => {
    const s = slugify("a".repeat(79) + " b c");
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("nextFreeSlug", () => {
  it("usa el base si está libre", () => {
    expect(nextFreeSlug("uno", ["uno-x"])).toBe("uno");
  });
  it("agrega -2, -3… si ya existe", () => {
    expect(nextFreeSlug("uno", ["uno"])).toBe("uno-2");
    expect(nextFreeSlug("uno", ["uno", "uno-2", "uno-3"])).toBe("uno-4");
  });
});
