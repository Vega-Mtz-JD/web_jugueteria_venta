// Ubicación de la tienda: coordenadas pegadas desde Google Maps, enlace de "Cómo llegar" y mapa embebido.

export const COORDINATES_ERROR = "Pega las coordenadas como aparecen en Google Maps, por ejemplo -16.5103, -68.1267";
export const MAPS_URL_ERROR = "Pega el enlace de Google Maps que mandas por WhatsApp";

export type Coordinates = { latitude: number; longitude: number };

// Misma regla que el check de store_settings.maps_url.
const MAPS_URL = /^https:\/\/((www\.)?google\.[a-z]{2,3}(\.[a-z]{2})?\/maps|maps\.google\.[a-z]{2,3}(\.[a-z]{2})?\/|maps\.app\.goo\.gl\/|goo\.gl\/maps\/)/;
const NUMBER = /^-?\d{1,3}(\.\d{1,8})?$/;

/** "-16.5103, -68.1267" (punto decimal, coma entre los dos) dentro de Bolivia; si no, null. */
export function parseCoordinates(text: string): Coordinates | null {
  const parts = text.split(",").map((p) => p.trim());
  if (parts.length !== 2 || !parts.every((p) => NUMBER.test(p))) return null;
  const [latitude, longitude] = parts.map(Number);
  if (latitude < -23 || latitude > -9 || longitude < -70 || longitude > -57) return null;
  return { latitude, longitude };
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude}, ${longitude}`;
}

export function isGoogleMapsUrl(url: string): boolean {
  return MAPS_URL.test(url);
}

/** "Cómo llegar": el enlace del dueño, si no las coordenadas, si no la dirección. */
export function directionsHref(s: { mapsUrl: string | null; latitude: number | null; longitude: number | null; address: string | null }): string | null {
  if (s.mapsUrl) return s.mapsUrl;
  const search = (query: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  if (s.latitude !== null && s.longitude !== null) return search(`${s.latitude},${s.longitude}`);
  if (s.address?.trim()) return search(s.address.trim());
  return null;
}

/** Mapa de Google con el pin exacto, sin clave. */
export function mapEmbedSrc(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}&z=17&output=embed`;
}
