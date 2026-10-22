import { describe, expect, it } from "vitest";
import { directionsHref, formatCoordinates, isGoogleMapsUrl, mapEmbedSrc, parseCoordinates } from "./location";

describe("parseCoordinates", () => {
  it("lee las coordenadas como las copia Google Maps", () => {
    expect(parseCoordinates("-16.5103, -68.1267")).toEqual({ latitude: -16.5103, longitude: -68.1267 });
    expect(parseCoordinates("-16.510312,-68.126745")).toEqual({ latitude: -16.510312, longitude: -68.126745 });
    expect(parseCoordinates("  -16.5103 ,  -68.1267 ")).toEqual({ latitude: -16.5103, longitude: -68.1267 });
  });
  it("rechaza lo que no sirve", () => {
    for (const bad of ["-16,5103, -68,1267", "16.5, 68.1", "-16.5103", "abc", "", "-16.5103, -68.1267, 3", "-30.1, -68.1"]) {
      expect(parseCoordinates(bad), bad).toBeNull();
    }
  });
});

describe("formatCoordinates", () => {
  it("las escribe como se pegan", () => {
    expect(formatCoordinates(-16.5103, -68.1267)).toBe("-16.5103, -68.1267");
  });
});

describe("isGoogleMapsUrl", () => {
  it("acepta los enlaces de Google Maps", () => {
    for (const ok of ["https://maps.app.goo.gl/AbC123", "https://www.google.com/maps/place/Ludiq/@-16.5,-68.1,17z", "https://maps.google.com/?q=x", "https://goo.gl/maps/xyz", "https://www.google.com.bo/maps/place/x"]) {
      expect(isGoogleMapsUrl(ok), ok).toBe(true);
    }
  });
  it("rechaza los demás", () => {
    for (const bad of ["http://maps.app.goo.gl/x", "https://evil.example/maps", "https://google.com.evil.io/maps", "maps.app.goo.gl/x", ""]) {
      expect(isGoogleMapsUrl(bad), bad).toBe(false);
    }
  });
});

describe("directionsHref", () => {
  const none = { mapsUrl: null, latitude: null, longitude: null, address: null };
  it("usa el enlace del dueño si existe", () => {
    expect(directionsHref({ ...none, mapsUrl: "https://maps.app.goo.gl/AbC123", latitude: -16.5, longitude: -68.1, address: "x" })).toBe("https://maps.app.goo.gl/AbC123");
  });
  it("si no, las coordenadas", () => {
    expect(directionsHref({ ...none, latitude: -16.5103, longitude: -68.1267, address: "x" })).toBe("https://www.google.com/maps/search/?api=1&query=-16.5103%2C-68.1267");
  });
  it("si no, la dirección", () => {
    expect(directionsHref({ ...none, address: "Calle 1, Sopocachi" })).toBe("https://www.google.com/maps/search/?api=1&query=Calle%201%2C%20Sopocachi");
  });
  it("sin nada, no hay enlace", () => {
    expect(directionsHref(none)).toBeNull();
    expect(directionsHref({ ...none, address: "   " })).toBeNull();
  });
});

describe("mapEmbedSrc", () => {
  it("mapa con el pin exacto", () => {
    expect(mapEmbedSrc(-16.5103, -68.1267)).toBe("https://www.google.com/maps?q=-16.5103,-68.1267&z=17&output=embed");
  });
});
