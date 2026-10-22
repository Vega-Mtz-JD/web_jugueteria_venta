import Link from "next/link";
import { MessageCircleIcon } from "lucide-react";
import { reorderMessage } from "@/features/admin/purchases/reorder";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import type { DashboardNow, DashboardSales } from "./queries";
import { TopProducts } from "./TopProducts";

const more = "inline-flex min-h-11 items-center font-semibold text-verde underline-offset-4 hover:underline";

/** Qué volver a comprar: lo más vendido del período y lo que se está agotando (ahora). */
export function RestockSection({ top, low }: { top: DashboardSales["top"]; low: DashboardNow["runningLow"] }) {
  return (
    <section aria-labelledby="volver-a-comprar" className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id="volver-a-comprar" className="mb-3 font-serif text-xl font-bold">
        Qué volver a comprar
      </h2>
      <TopProducts top={top} />

      <h3 className="mt-5 mb-2 font-semibold">Se está agotando</h3>
      {low.items.length === 0 ? (
        <p className="text-muted-foreground">Nada se está agotando.</p>
      ) : (
        <ul aria-label="Se está agotando" className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {low.items.map((p) => (
            <li key={p.productId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-background/50 px-3 py-2">
              <Link href={`/panel/productos/${p.productId}`} className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {p.stock === 0 ? <span className="font-semibold text-rojo">Agotado</span> : `Quedan ${p.stock}`}
                  {p.sold30d > 0 && ` · ${p.sold30d === 1 ? "1 vendido" : `${p.sold30d} vendidos`} en 30 días`}
                </span>
              </Link>
              {p.reorder?.whatsapp && (
                <a
                  href={buildWhatsAppLink(
                    p.reorder.whatsapp,
                    reorderMessage({ supplierContact: p.reorder.contactName, supplierName: p.reorder.supplierName, productName: p.name, quantity: p.reorder.quantity }),
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-verde px-3 text-sm font-semibold text-verde hover:bg-verde/10"
                >
                  <MessageCircleIcon aria-hidden className="size-4" />
                  Pedir de nuevo
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 flex flex-wrap gap-x-4">
        <Link href="/panel/productos?filtro=poco-stock" className={more}>
          Ver poco stock ({low.lowStockCount})
        </Link>
        <Link href="/panel/productos?filtro=agotados" className={more}>
          Ver agotados ({low.outOfStockCount})
        </Link>
      </p>
    </section>
  );
}
