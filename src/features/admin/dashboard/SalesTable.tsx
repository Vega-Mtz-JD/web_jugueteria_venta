import Link from "next/link";
import { formatOrderCode } from "@/features/orders/status";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { SalesList } from "./queries";
import { CHANNELS } from "./sales-filter";

const when = new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" });
const channelLabel = (c: string) => CHANNELS.find((x) => x.value === c)?.label ?? c;
const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

function Total({ label, value, tone }: { label: string; value: string; tone?: "alert" }) {
  return (
    <div className="rounded-2xl bg-background/50 px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("font-serif text-2xl font-extrabold tabular-nums", tone === "alert" && "text-madera")}>
        <span className="sr-only">{label} </span>
        {value}
      </dd>
    </div>
  );
}

/** Totales y filas de la página Ventas: los totales siempre cubren todo el filtro. */
export function SalesTable({ list }: { list: SalesList }) {
  const t = list.totals;
  return (
    <>
      <section aria-labelledby="totales" className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
        <h2 id="totales" className="sr-only">
          Totales
        </h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Total label="Vendiste" value={formatBs(t.salesCents)} />
          <Total label="Te costaron" value={formatBs(t.costCents)} />
          <Total label="Ganancia" value={formatBs(t.profitCents)} />
          <Total label="Sin costo anotado" value={formatBs(t.withoutCostCents)} tone={t.withoutCostCents > 0 ? "alert" : undefined} />
          <Total label="Envíos cobrados" value={formatBs(t.shippingCents)} />
        </dl>
        <p className="mt-3 font-semibold">
          {plural(t.count, "venta", "ventas")} · {plural(t.units, "juego", "juegos")}
        </p>
        {t.withoutCostCents > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">Las ventas sin costo anotado no entran en la ganancia.</p>
        )}
      </section>

      {list.rows.length === 0 ? (
        <p className="mt-6 text-muted-foreground">No hay ventas en este período.</p>
      ) : (
        <ul aria-label="Ventas" className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-2">
          {list.rows.map((r, i) => (
            <li
              key={`${r.orderId ?? r.manualSaleId}-${r.productId}-${i}`}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-2xl border border-[#eadcc4] bg-papel px-4 py-3",
                r.unitCostCents === null && "border-madera/50",
              )}
            >
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {r.quantity > 1 && `${r.quantity} × `}
                  {r.productName}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {when.format(new Date(r.soldAt))} · {channelLabel(r.channel)}
                  {" · "}
                  {r.orderId ? (
                    <Link href={`/panel/pedidos/${r.orderId}`} className="font-semibold text-verde underline-offset-4 hover:underline">
                      Pedido {formatOrderCode(r.orderNumber ?? 0)}
                    </Link>
                  ) : (
                    <Link href={`/panel/productos/${r.productId}`} className="font-semibold text-verde underline-offset-4 hover:underline">
                      Ver juego
                    </Link>
                  )}
                </span>
              </span>
              <span className="text-right">
                <span className="block font-serif text-lg font-bold tabular-nums">{formatBs(r.quantity * r.unitPriceCents)}</span>
                <span className="block text-sm tabular-nums">
                  {r.unitCostCents === null ? (
                    <span className="font-semibold text-madera">sin costo</span>
                  ) : (
                    <>
                      costo {formatBs(r.quantity * r.unitCostCents)} ·{" "}
                      <span className={cn("font-semibold", (r.profitCents ?? 0) < 0 ? "text-rojo" : "text-verde")}>gana {formatBs(r.profitCents ?? 0)}</span>
                    </>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {list.rowCount > list.rows.length && (
        <p className="mt-3 text-sm text-muted-foreground">
          Mostrando las {list.rows.length} más recientes de {list.rowCount}. Los totales incluyen todas.
        </p>
      )}
    </>
  );
}
