import { describe, expect, it } from "vitest";
import { barAmount, barScale } from "./bars";

describe("barScale", () => {
  it("todo en cero no divide por cero", () => {
    expect(barScale([0, 0, 0])).toEqual([
      { pct: 0, negative: false },
      { pct: 0, negative: false },
      { pct: 0, negative: false },
    ]);
  });
  it("escala contra el mayor valor absoluto y marca los negativos", () => {
    expect(barScale([100, 50, -50])).toEqual([
      { pct: 100, negative: false },
      { pct: 50, negative: false },
      { pct: 50, negative: true },
    ]);
  });
  it("sin barras", () => {
    expect(barScale([])).toEqual([]);
  });
});

describe("barAmount", () => {
  it("monto corto para que quepa encima de la barra", () => {
    expect(barAmount(0)).toBe("0");
    expect(barAmount(34550)).toBe("346");
    expect(barAmount(345000)).toBe("3,5 mil");
    expect(barAmount(1250000)).toBe("13 mil");
    expect(barAmount(-120000)).toBe("−1,2 mil");
    expect(barAmount(-3500)).toBe("−35");
  });
});
