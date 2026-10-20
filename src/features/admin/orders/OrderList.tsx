import Link from "next/link";
import { ChevronRightIcon, ClockAlertIcon } from "lucide-react";
import { ADMIN_STATUS_LABEL, formatOrderCode } from "@/features/orders/status";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatBs } from "@/lib/money";
import type { AdminOrderRow } from "../queries";

const when = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" });
const METHOD = { recojo: "Recojo", envio_ciudad: "Envío en La Paz", encomienda: "Encomienda" } as const;

export function OrderList({ orders, empty }: { orders: AdminOrderRow[]; empty: string }) {
  if (orders.length === 0) {
    return <p className="rounded-3xl border border-dashed border-input bg-papel px-6 py-12 text-center text-muted-foreground">{empty}</p>;
  }
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/panel/pedidos/${o.id}`}
            className="flex items-center gap-3 rounded-2xl border border-[#eadcc4] bg-papel p-4 transition-colors hover:border-madera"
          >
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-2 font-serif text-lg font-bold">
                {formatOrderCode(o.number)}
                <span className="truncate font-sans text-base font-semibold">{o.recipientName}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                {when.format(new Date(o.createdAt))} · {METHOD[o.deliveryMethod]} · {o.itemCount === 1 ? "1 producto" : `${o.itemCount} productos`} ·{" "}
                <span className="font-semibold text-tinta">{formatBs(o.totalCents)}</span>
              </p>
              {o.over24h && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-rojo/12 px-2.5 py-0.5 text-sm font-semibold text-rojo">
                  <ClockAlertIcon aria-hidden className="size-4" />
                  Hace más de 24 h
                </p>
              )}
            </div>
            <StatusBadge status={o.status} labels={ADMIN_STATUS_LABEL} />
            <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
