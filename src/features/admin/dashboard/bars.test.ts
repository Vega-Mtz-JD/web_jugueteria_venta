import { describe, expect, it } from "vitest";
import { barScale } from "./bars";

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
