"use client";

import Link from "next/link";
import { useState } from "react";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { TopProduct } from "./queries";

const ORDERS = [
  { value: "units", label: "Unidades" },
  { value: "revenue", label: "Ingresos" },
] as const;

/** Lo más vendido del período, por unidades o por ingresos (la base ya trae los 20 primeros). */
export function TopProducts({ top }: { top: TopProduct[] }) {
  const [order, setOrder] = useState<"units" | "revenue">("units");
  const rows = [...top]
    .sort((a, b) => (order === "units" ? b.units - a.units || b.revenueCents - a.revenueCents : b.revenueCents - a.revenueCents || b.units - a.units))
    .slice(0, 10);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Lo más vendido</h3>
        <div role="group" aria-label="Ordenar por" className="flex gap-1 rounded-full bg-crema-2 p-1">
          {ORDERS.map((o) => (
            <button
              key={o.value}
              type="button"
              aria-pressed={order === o.value}
              onClick={() => setOrder(o.value)}
              className={cn("min-h-9 rounded-full px-3 text-sm font-semibold", order === o.value ? "bg-verde text-crema" : "text-tinta-suave")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay ventas en este período.</p>
      ) : (
        <ol aria-label="Lo más vendido" className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {rows.map((p) => (
            <li key={p.productId}>
              <Link href={`/panel/productos/${p.productId}`} className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-3 py-2 hover:bg-crema-2">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.units === 1 ? "1 vendido" : `${p.units} vendidos`} · quedan {p.stock}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  <span className="block font-semibold">{formatBs(p.revenueCents)}</span>
                  <span className="block text-muted-foreground">
                    {p.unitsWithoutCost === p.units ? "sin costo" : `gana ${formatBs(p.profitCents)}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
