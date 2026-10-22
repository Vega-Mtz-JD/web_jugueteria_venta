"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { isMotionPaused, MOTION_EVENT } from "@/components/brand/MotionToggle";
import type { StorePhoto } from "@/features/catalog/types";
import { cn } from "@/lib/utils";
import { AUTOPLAY_MS, canAutoplay, nextIndex } from "./carousel";

/** Carrusel liviano (scroll-snap, sin librerías): solo la primera foto se carga al abrir la página. */
export function PhotoCarousel({ photos }: { photos: StorePhoto[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [interacting, setInteracting] = useState(false);
  // Hasta saber la preferencia del navegador, no se mueve.
  const [reducedMotion, setReducedMotion] = useState(true);
  const [paused, setPaused] = useState(false);
  // Solo la primera foto va en la carga inicial; las demás, cuando el navegador queda libre o se toca el carrusel.
  const [loadRest, setLoadRest] = useState(false);
  const count = photos.length;

  useEffect(() => {
    if (count < 2) return;
    const load = () => setLoadRest(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(load, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 2000);
    return () => window.clearTimeout(id);
  }, [count]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(media.matches);
      setPaused(isMotionPaused());
    };
    sync();
    media.addEventListener("change", sync);
    window.addEventListener(MOTION_EVENT, sync);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener(MOTION_EVENT, sync);
    };
  }, []);

  const goTo = useCallback(
    (index: number) => {
      setLoadRest(true);
      const el = track.current;
      if (!el) return;
      el.scrollTo({ left: index * el.clientWidth, behavior: reducedMotion ? "auto" : "smooth" });
      setActive(index);
    },
    [reducedMotion],
  );

  useEffect(() => {
    if (!canAutoplay({ count, reducedMotion, paused, interacting })) return;
    const timer = window.setTimeout(() => goTo(nextIndex(active, count)), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, count, reducedMotion, paused, interacting, goTo]);

  const busy = () => {
    setInteracting(true);
    setLoadRest(true);
  };
  const free = () => setInteracting(false);

  return (
    <section
      aria-roledescription="carrusel"
      aria-label="Fotos de la tienda"
      onPointerEnter={busy}
      onPointerLeave={free}
      onFocus={busy}
      onBlur={free}
    >
      <div
        ref={track}
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.clientWidth > 0) setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((photo, i) => (
          <figure key={photo.id} role="group" aria-roledescription="diapositiva" aria-label={`${i + 1} de ${count}`} className="w-full shrink-0 snap-center">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-sm bg-crema-2">
              {(i === 0 || loadRest) && (
                <Image
                  src={photo.url}
                  alt={photo.caption}
                  fill
                  sizes="(max-width: 768px) 70vw, 320px"
                  className="object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "low"}
                />
              )}
            </div>
            <figcaption className="truncate pt-2 text-center font-serif text-sm font-semibold text-tinta">{photo.caption}</figcaption>
          </figure>
        ))}
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              aria-label={`Ver foto ${i + 1} de ${count}`}
              aria-current={i === active ? "true" : undefined}
              onClick={() => goTo(i)}
              className="grid size-6 place-items-center rounded-full focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span aria-hidden className={cn("size-2 rounded-full transition-colors", i === active ? "bg-verde" : "bg-madera/35")} />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
