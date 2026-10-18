"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

type GalleryImage = { url: string; alt: string };

/** Fotos deslizables (scroll-snap) con miniaturas para elegir; funciona igual con el dedo o el mouse. */
export function ProductGallery({ images, soldOut }: { images: GalleryImage[]; soldOut: boolean }) {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  const goTo = (index: number) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    setCurrent(index);
  };

  const onScroll = () => {
    const el = track.current;
    if (el) setCurrent(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="min-w-0">
      <div
        ref={track}
        onScroll={onScroll}
        className="flex aspect-square snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-3xl bg-crema-2 [scrollbar-width:none]"
      >
        {images.map((img, i) => (
          <div key={img.url} className="relative size-full shrink-0 snap-center">
            <Image
              src={img.url}
              alt={img.alt}
              fill
              priority={i === 0}
              sizes="(min-width: 768px) 50vw, 100vw"
              unoptimized={img.url.endsWith(".svg")}
              className={cn("object-contain p-6", soldOut && "opacity-60")}
            />
          </div>
        ))}
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-2" role="group" aria-label="Elegir foto">
          {images.map((img, i) => (
            <button
              key={img.url}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={current === i}
              className={cn(
                "relative size-16 overflow-hidden rounded-xl border-2 bg-crema-2",
                current === i ? "border-verde" : "border-transparent",
              )}
            >
              <Image src={img.url} alt="" fill sizes="64px" unoptimized={img.url.endsWith(".svg")} className="object-contain p-1" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
