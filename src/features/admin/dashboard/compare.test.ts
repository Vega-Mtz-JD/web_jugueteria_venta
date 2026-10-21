import { describe, expect, it } from "vitest";
import { compareLine } from "./compare";
import type { SalesTotals } from "./queries";

const totals = (o: Partial<SalesTotals>): SalesTotals => ({
  salesCents: 0, count: 1, units: 1, costCents: 0, profitCents: 0, withoutCostCents: 0, withoutCostUnits: 0, shippingCents: 0, ...o,
});

describe("compareLine", () => {
  it("compara la ganancia cuando no faltan costos", () => {
    expect(compareLine(totals({ profitCents: 180000 }), totals({ profitCents: 145000 }), "septiembre")).toEqual({
      tone: "up",
      text: "▲ Bs 350 más que septiembre",
    });
    expect(compareLine(totals({ profitCents: 8000 }), totals({ profitCents: 20000 }), "ayer")).toEqual({
      tone: "down",
      text: "▼ Bs 120 menos que ayer",
    });
  });
  it("dice si es igual", () => {
    expect(compareLine(totals({ profitCents: 5000 }), totals({ profitCents: 5000 }), "ayer")).toEqual({ tone: "same", text: "Igual que ayer" });
  });
  it("si faltan costos en cualquiera de los dos, compara las ventas", () => {
    const text = "▲ Vendiste Bs 800 más que septiembre · la ganancia no se compara porque faltan costos";
    expect(compareLine(totals({ salesCents: 520000, withoutCostCents: 100 }), totals({ salesCents: 440000 }), "septiembre")).toEqual({ tone: "up", text });
    expect(compareLine(totals({ salesCents: 520000 }), totals({ salesCents: 440000, withoutCostCents: 1 }), "septiembre").text).toBe(text);
    expect(compareLine(totals({ salesCents: 100000, withoutCostCents: 1 }), totals({ salesCents: 150000 }), "ayer").text).toBe(
      "▼ Vendiste Bs 500 menos que ayer · la ganancia no se compara porque faltan costos",
    );
  });
  it("sin ventas en el período anterior no compara", () => {
    expect(compareLine(totals({ profitCents: 5000 }), totals({ count: 0 }), "septiembre")).toEqual({
      tone: "neutral",
      text: "Sin ventas en septiembre para comparar",
    });
  });
});
