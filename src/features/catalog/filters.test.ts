import { describe, expect, it } from "vitest";
import { catalogHref, parseCatalogFilters, settingsFromRow } from "./filters";

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

describe("catalogHref", () => {
  it("sin filtros apunta al catálogo limpio", () => {
    expect(catalogHref({ orden: "destacados" })).toBe("/catalogo");
  });

  it("escribe los filtros con los nombres de la URL y omite el orden por defecto", () => {
    expect(
      catalogHref({ categoria: "cartas", q: "uno dos", precioMin: 20, precioMax: 100, edad: 8, jugadores: 4, ofertas: true, orden: "precio_asc" }),
    ).toBe("/catalogo?categoria=cartas&q=uno+dos&precio_min=20&precio_max=100&edad=8&jugadores=4&ofertas=1&orden=precio_asc");
  });

  it("ida y vuelta con parseCatalogFilters", () => {
    const f = { categoria: "casino", jugadores: 2, orden: "nuevos" as const };
    const sp = Object.fromEntries(new URL(catalogHref(f), "http://x").searchParams);
    expect(parseCatalogFilters(sp)).toEqual(f);
  });
});

describe("settingsFromRow", () => {
  it("sin fila de ajustes usa valores por defecto en vez de fallar", () => {
    expect(settingsFromRow(null)).toEqual({
      storeName: "Ludiq",
      tagline: null,
      whatsappPhone: null,
      address: null,
      pickupHours: null,
      zone: null,
      mapsUrl: null,
      latitude: null,
      longitude: null,
    });
  });

  it("lee la ubicación (numeric llega como texto o número)", () => {
    const row = { store_name: "Ludiq", tagline: null, whatsapp_phone: null, address: "Calle 1", pickup_hours: null, zone: "Sopocachi", maps_url: "https://maps.app.goo.gl/AbC123", latitude: "-16.5103", longitude: -68.1267 };
    expect(settingsFromRow(row)).toMatchObject({ zone: "Sopocachi", mapsUrl: "https://maps.app.goo.gl/AbC123", latitude: -16.5103, longitude: -68.1267 });
  });
});
