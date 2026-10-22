// Carrusel de la postal: pasa solo cada 5 s salvo que algo lo frene (accesibilidad y quien lo está mirando).

export const AUTOPLAY_MS = 5000;

export function nextIndex(current: number, count: number): number {
  return (current + 1) % count;
}

export function canAutoplay(s: { count: number; reducedMotion: boolean; paused: boolean; interacting: boolean }): boolean {
  return s.count >= 2 && !s.reducedMotion && !s.paused && !s.interacting;
}
