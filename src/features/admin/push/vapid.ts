/** Clave VAPID pública (base64url) → bytes para `pushManager.subscribe({ applicationServerKey })`. */
export function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** ¿El navegador se suscribió con la clave VAPID actual? (si se rotó, la suscripción vieja ya no sirve) */
export function sameServerKey(subscribedKey: ArrayBuffer | null | undefined, currentKey: string): boolean {
  if (!subscribedKey || !currentKey) return false;
  const a = new Uint8Array(subscribedKey);
  const b = urlBase64ToUint8Array(currentKey);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
