import type { StorePhoto, StoreSettings } from "@/features/catalog/types";
import { directionsHref } from "./location";
import { PhotoCarousel } from "./PhotoCarousel";

/** Postal de la portada: las fotos del local y de La Paz en un marco blanco, con la zona y "Cómo llegar". */
export function StorePostcard({ photos, settings }: { photos: StorePhoto[]; settings: StoreSettings }) {
  const directions = directionsHref(settings);
  return (
    <div className="relative flex w-64 flex-col items-center md:w-80">
      <div className="w-full -rotate-2 rounded-md bg-white p-2.5 pb-1 shadow-[0_14px_30px_-8px_rgb(43_33_24/0.35)]">
        <PhotoCarousel photos={photos} />
      </div>
      {directions && (
        <p className="mt-3 inline-flex flex-wrap items-center justify-center gap-x-1.5 rounded-full bg-crema/85 px-3 py-1 text-sm text-tinta-suave backdrop-blur">
          <span>📍 {settings.zone ? `${settings.zone}, La Paz` : "La Paz"}</span>
          <span aria-hidden>·</span>
          <a href={directions} target="_blank" rel="noreferrer" className="font-semibold text-verde underline-offset-4 hover:underline">
            Cómo llegar
          </a>
        </p>
      )}
    </div>
  );
}
