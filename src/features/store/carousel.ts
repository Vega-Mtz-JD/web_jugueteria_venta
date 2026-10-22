// Carrusel de la postal: pasa solo cada 5 s salvo que algo lo frene (accesibilidad y quien lo está mirando).

export const AUTOPLAY_MS = 5000;

export function nextIndex(current: number, count: number): number {
  return (current + 1) % count;
}

/** `visible`: el carrusel está en pantalla y la pestaña a la vista (si no, pasar fotos solo gasta datos). */
export function canAutoplay(s: { count: number; reducedMotion: boolean; paused: boolean; interacting: boolean; visible: boolean }): boolean {
  return s.count >= 2 && s.visible && !s.reducedMotion && !s.paused && !s.interacting;
}
