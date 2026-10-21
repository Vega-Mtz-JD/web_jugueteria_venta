import { describe, expect, it } from "vitest";
import { parseSalesFilter, salesHref } from "./sales-filter";

describe("parseSalesFilter", () => {
  it("lee período, canal y sin costo", () => {
    expect(parseSalesFilter({ periodo: "hoy", canal: "tienda", sincosto: "1" })).toEqual({
      period: "hoy", from: null, to: null, channel: "tienda", withoutCost: true,
    });
  });
  it("lee un rango de fechas", () => {
    expect(parseSalesFilter({ desde: "2026-10-05", hasta: "2026-10-11" })).toEqual({
      period: null, from: "2026-10-05", to: "2026-10-11", channel: null, withoutCost: false,
    });
  });
  it("con fechas inválidas, al revés o sin nada usa Este mes", () => {
    const mes = { period: "mes", from: null, to: null, channel: null, withoutCost: false };
    expect(parseSalesFilter({ desde: "2026-13-40", hasta: "2026-10-11" })).toEqual(mes);
    expect(parseSalesFilter({ desde: "2026-02-30", hasta: "2026-03-01" })).toEqual(mes);
    expect(parseSalesFilter({ desde: "2026-10-11", hasta: "2026-10-05" })).toEqual(mes);
    expect(parseSalesFilter({})).toEqual(mes);
  });
  it("ignora un canal desconocido", () => {
    expect(parseSalesFilter({ canal: "feria" }).channel).toBeNull();
  });
});

describe("salesHref", () => {
  it("arma la dirección de la lista", () => {
    expect(salesHref({ from: "2026-10-05", to: "2026-10-11", channel: "web" })).toBe("/panel/ventas?desde=2026-10-05&hasta=2026-10-11&canal=web");
    expect(salesHref({ period: "mes" })).toBe("/panel/ventas?periodo=mes");
    expect(salesHref({ period: "hoy", withoutCost: true })).toBe("/panel/ventas?periodo=hoy&sincosto=1");
  });
  it("vuelve a leerse igual", () => {
    const f = { period: null, from: "2026-10-05", to: "2026-10-11", channel: "whatsapp" as const, withoutCost: true };
    const sp = Object.fromEntries(new URL(salesHref(f), "http://x").searchParams);
    expect(parseSalesFilter(sp)).toEqual(f);
  });
});
