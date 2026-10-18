import { MessageCircleIcon } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import type { StoreSettings } from "@/features/catalog/types";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export function SiteFooter({ settings }: { settings: StoreSettings }) {
  return (
    <footer className="mt-auto bg-tinta text-crema">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo storeName={settings.storeName} />
          {settings.tagline && <p className="mt-3 max-w-xs text-crema/75">{settings.tagline}</p>}
        </div>
        <div className="text-sm leading-relaxed text-crema/80">
          <h2 className="mb-2 font-serif text-base text-crema">Visítanos</h2>
          {settings.address && <p>{settings.address}</p>}
          {settings.pickupHours && <p>{settings.pickupHours}</p>}
        </div>
        {settings.whatsappPhone && (
          <div>
            <h2 className="mb-3 font-serif text-base">¿Tienes una pregunta?</h2>
            <a
              href={buildWhatsAppLink(settings.whatsappPhone, "Hola, tengo una consulta")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-cubo-verde px-4 font-semibold text-white transition-colors hover:bg-verde-2"
            >
              <MessageCircleIcon className="size-5" />
              Escríbenos por WhatsApp
            </a>
          </div>
        )}
      </div>
    </footer>
  );
}
