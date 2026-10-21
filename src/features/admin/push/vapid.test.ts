import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./vapid";

describe("urlBase64ToUint8Array", () => {
  it("convierte una clave pública VAPID (65 bytes, empieza con 0x04)", () => {
    const bytes = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
    const key = Buffer.from(bytes).toString("base64url");
    const out = urlBase64ToUint8Array(key);
    expect(out).toHaveLength(65);
    expect(out[0]).toBe(4);
    expect(Array.from(out)).toEqual(Array.from(bytes));
  });
  it("acepta - y _ y la falta de relleno", () => {
    expect(Array.from(urlBase64ToUint8Array("-_8"))).toEqual([0xfb, 0xff]);
  });
});

describe("sameServerKey", () => {
  it("compara la clave con la que se suscribió el navegador contra la actual", async () => {
    const { sameServerKey } = await import("./vapid");
    const bytes = new Uint8Array(65).map((_, i) => (i === 0 ? 4 : i));
    const key = Buffer.from(bytes).toString("base64url");
    expect(sameServerKey(bytes.buffer, key)).toBe(true);
    const other = new Uint8Array(bytes);
    other[10] = 99;
    expect(sameServerKey(other.buffer, key)).toBe(false);
    expect(sameServerKey(null, key)).toBe(false);
  });
});
