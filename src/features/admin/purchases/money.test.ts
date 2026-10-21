import { describe, expect, it } from "vitest";
import { formatMoney, moneyToCents, parseRate } from "./money";

describe("parseRate (a cuánto estaba el dólar)", () => {
  it("acepta coma o punto y enteros", () => {
    expect(parseRate("6,96")).toBe(6.96);
    expect(parseRate("6.96")).toBe(6.96);
    expect(parseRate(" 7 ")).toBe(7);
    expect(parseRate("6,9612")).toBe(6.9612);
  });
  it("rechaza cero, negativos, más de 4 decimales, valores absurdos y texto", () => {
    for (const t of ["0", "-1", "6,96123", "100", "abc", "", "6,9,6"]) expect(parseRate(t)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("Bs y US$ con el mismo formato boliviano", () => {
    expect(formatMoney(123450, "BOB")).toBe("Bs 1.234,50");
    expect(formatMoney(123450, "USD")).toBe("US$ 1.234,50");
    expect(formatMoney(-2000, "BOB")).toBe("Bs -20");
  });
});

describe("moneyToCents", () => {
  it("convierte montos escritos", () => {
    expect(moneyToCents("426")).toBe(42600);
    expect(moneyToCents("1.250,50")).toBe(125050);
    expect(moneyToCents("x")).toBeNull();
  });
});
