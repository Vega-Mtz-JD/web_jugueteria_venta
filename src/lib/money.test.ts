import { describe, expect, it } from "vitest";
import { bsToCents, formatBs } from "./money";

describe("formatBs", () => {
  it("muestra bolivianos enteros sin decimales", () => {
    expect(formatBs(12000)).toBe("Bs 120");
    expect(formatBs(0)).toBe("Bs 0");
  });

  it("separa miles con punto", () => {
    expect(formatBs(125000)).toBe("Bs 1.250");
  });

  it("muestra decimales con coma solo si no son cero", () => {
    expect(formatBs(12050)).toBe("Bs 120,50");
  });
});

describe("bsToCents", () => {
  it("convierte bolivianos a centavos sin errores de redondeo", () => {
    expect(bsToCents(120.5)).toBe(12050);
  });
});
