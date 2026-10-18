import { describe, expect, it } from "vitest";
import { parseCatalogFilters } from "./filters";

describe("parseCatalogFilters", () => {
  it("sin parámetros usa el orden por defecto", () => {
    expect(parseCatalogFilters({})).toEqual({ orden: "destacados" });
  });

  it("lee todos los filtros válidos", () => {
    expect(
      parseCatalogFilters({
        categoria: "cartas",
        q: "uno",
        precio_min: "20",
        precio_max: "100",
        edad: "8",
        jugadores: "4",
        orden: "precio_asc",
      }),
    ).toEqual({ categoria: "cartas", q: "uno", precioMin: 20, precioMax: 100, edad: 8, jugadores: 4, orden: "precio_asc" });
  });

  it("ignora valores inválidos en lugar de fallar", () => {
    expect(parseCatalogFilters({ precio_min: "abc", jugadores: "-3", edad: "200", orden: "raro", q: "   " })).toEqual({
      orden: "destacados",
    });
  });

  it("invierte precio mínimo y máximo si vienen al revés", () => {
    expect(parseCatalogFilters({ precio_min: "100", precio_max: "20" })).toEqual({
      orden: "destacados",
      precioMin: 20,
      precioMax: 100,
    });
  });

  it("si un parámetro viene repetido usa el primero", () => {
    expect(parseCatalogFilters({ categoria: ["a", "b"] })).toEqual({ categoria: "a", orden: "destacados" });
  });

  it("ofertas solo se activa con ofertas=1", () => {
    expect(parseCatalogFilters({ ofertas: "1" })).toEqual({ ofertas: true, orden: "destacados" });
    expect(parseCatalogFilters({ ofertas: "si" })).toEqual({ orden: "destacados" });
  });
});
