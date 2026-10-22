import { ClockIcon, MapPinIcon, MessageCircleIcon, NavigationIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StoreSettings } from "@/features/catalog/types";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { directionsHref, mapEmbedSrc } from "./location";
import { MapLoader } from "./MapLoader";

/** "Visítanos": dirección, horario, cómo llegar, WhatsApp y el mapa (solo si se pide). Sin dirección no aparece. */
export function VisitSection({ settings }: { settings: StoreSettings }) {
  if (!settings.address?.trim()) return null;
  const directions = directionsHref(settings);
  const hasMap = settings.latitude !== null && settings.longitude !== null;
  return (
    <section aria-labelledby="visitanos" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
      <div className="grid gap-5 rounded-3xl border border-[#eadcc4] bg-papel p-5 sm:p-8 md:grid-cols-2">
        <div>
          <h2 id="visitanos" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Visítanos en La Paz
          </h2>
          <p className="mt-3 flex gap-2 text-tinta-suave">
            <MapPinIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-rojo" />
            {settings.address}
          </p>
          {settings.pickupHours && (
            <p className="mt-2 flex gap-2 text-tinta-suave">
              <ClockIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-verde" />
              Horario: {settings.pickupHours}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            {directions && (
              <Button asChild size="lg">
                <a href={directions} target="_blank" rel="noreferrer">
                  <NavigationIcon aria-hidden />
                  Cómo llegar
                </a>
              </Button>
            )}
            {settings.whatsappPhone && (
              <Button asChild size="lg" variant="outline">
                <a href={buildWhatsAppLink(settings.whatsappPhone, "Hola, quiero visitar la tienda")} target="_blank" rel="noreferrer">
                  <MessageCircleIcon aria-hidden />
                  WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
        {hasMap && <MapLoader src={mapEmbedSrc(settings.latitude as number, settings.longitude as number)} />}
      </div>
    </section>
  );
}
