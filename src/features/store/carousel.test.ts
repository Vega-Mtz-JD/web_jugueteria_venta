import { describe, expect, it } from "vitest";
import { AUTOPLAY_MS, canAutoplay, nextIndex } from "./carousel";

describe("nextIndex", () => {
  it("avanza y da la vuelta", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
});

describe("canAutoplay", () => {
  const base = { count: 2, reducedMotion: false, paused: false, interacting: false, visible: true };
  it("pasa solo cada 5 s con 2 o más fotos y nada que lo frene", () => {
    expect(AUTOPLAY_MS).toBe(5000);
    expect(canAutoplay(base)).toBe(true);
  });
  it("no pasa con una sola foto, con movimiento reducido, en pausa o mientras se toca", () => {
    expect(canAutoplay({ ...base, count: 1 })).toBe(false);
    expect(canAutoplay({ ...base, reducedMotion: true })).toBe(false);
    expect(canAutoplay({ ...base, paused: true })).toBe(false);
    expect(canAutoplay({ ...base, interacting: true })).toBe(false);
  });
  it("no pasa si el carrusel no se ve (fuera de pantalla o pestaña oculta): no gasta datos", () => {
    expect(canAutoplay({ ...base, visible: false })).toBe(false);
  });
});
