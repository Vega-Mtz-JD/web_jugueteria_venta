import { describe, expect, it } from "vitest";
import { barLabel, parsePeriod, PERIODS, previousLabel, profitTitle } from "./period";

const oct = { from: "2026-10-01", to: "2026-10-21" };

describe("parsePeriod", () => {
  it("usa Este mes si falta o no se conoce", () => {
    expect(parsePeriod(undefined)).toBe("mes");
    expect(parsePeriod("semana")).toBe("mes");
  });
  it("toma el primero si viene repetido", () => {
    expect(parsePeriod(["hoy", "mes"])).toBe("hoy");
  });
  it("tiene los cinco botones en orden", () => {
    expect(PERIODS.map((p) => p.label)).toEqual(["Hoy", "7 días", "Este mes", "Mes anterior", "12 meses"]);
  });
});

describe("profitTitle", () => {
  it("dice el período en palabras", () => {
    expect(profitTitle("mes", oct)).toBe("Ganaste en octubre");
    expect(profitTitle("hoy", { from: "2026-10-21", to: "2026-10-21" })).toBe("Ganaste hoy");
    expect(profitTitle("7dias", { from: "2026-10-15", to: "2026-10-21" })).toBe("Ganaste en los últimos 7 días");
    expect(profitTitle("12meses", { from: "2025-11-01", to: "2026-10-21" })).toBe("Ganaste en los últimos 12 meses");
    expect(profitTitle("mes-anterior", { from: "2026-09-01", to: "2026-09-30" })).toBe("Ganaste en septiembre");
  });
});

describe("previousLabel", () => {
  it("nombra el período con el que se compara", () => {
    expect(previousLabel("mes", oct)).toBe("septiembre");
    expect(previousLabel("mes", { from: "2027-01-01", to: "2027-01-10" })).toBe("diciembre");
    expect(previousLabel("mes-anterior", { from: "2026-09-01", to: "2026-09-30" })).toBe("agosto");
    expect(previousLabel("hoy", oct)).toBe("ayer");
    expect(previousLabel("7dias", oct)).toBe("los 7 días anteriores");
    expect(previousLabel("12meses", oct)).toBe("los 12 meses anteriores");
  });
});

describe("barLabel", () => {
  it("día, semana o mes", () => {
    expect(barLabel("dia", "2026-10-19", 1)).toBe("lun 19");
    expect(barLabel("dia", "2026-10-20", 2)).toBe("mar 20");
    expect(barLabel("dia", "2026-10-25", 6)).toBe("dom 25");
    expect(barLabel("semana", "2026-10-05", 2)).toBe("sem 2");
    expect(barLabel("mes", "2026-10-01", 12)).toBe("oct");
  });
});
