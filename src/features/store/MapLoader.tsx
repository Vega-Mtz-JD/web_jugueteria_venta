"use client";

import { MapIcon } from "lucide-react";
import { useState } from "react";

/** El mapa de Google pesa: no se carga hasta que la persona lo pide. */
export function MapLoader({ src }: { src: string }) {
  const [shown, setShown] = useState(false);
  if (shown) {
    return <iframe title="Mapa de Ludiq en La Paz" src={src} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full rounded-2xl border-0 md:h-full md:min-h-64" />;
  }
  return (
    <div className="grid h-64 place-items-center rounded-2xl bg-[linear-gradient(90deg,#e6e1d4_1px,transparent_1px),linear-gradient(0deg,#e6e1d4_1px,transparent_1px)] bg-[size:22px_22px] bg-crema-2 md:h-full md:min-h-64">
      <button
        type="button"
        onClick={() => setShown(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-papel px-4 font-semibold text-verde shadow-sm hover:bg-crema focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <MapIcon aria-hidden className="size-5" />
        Ver el mapa
      </button>
    </div>
  );
}
