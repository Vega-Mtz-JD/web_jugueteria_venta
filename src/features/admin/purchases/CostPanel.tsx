"use client";

import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatBs } from "@/lib/money";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { callAction } from "../call-action";
import { setInitialCostAction } from "../product-actions";
import { centsToBsText } from "../product-schema";
import type { ProductCostSummary } from "../queries";
import { control, field } from "../settings/shared";
import { reorderMessage } from "./reorder";

const day = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" });

/** Costo vigente, margen, compras y ganancia de un producto (solo en el panel). */
export function CostPanel({ productId, productName, priceCents, summary }: { productId: string; productName: string; priceCents: number; summary: ProductCostSummary }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const cost = summary.currentUnitCostCents;
  const margin = cost === null ? null : priceCents - cost;
  const marginPct = margin === null || priceCents <= 0 ? null : Math.round((margin / priceCents) * 100);
  const last = summary.lastPurchase;

  return (
    <section aria-labelledby="costo-titulo" className="grid gap-4 rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id="costo-titulo" className="font-serif text-xl font-bold">
        Costo y ganancia
      </h2>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-muted-foreground">Costo por unidad</dt>
          <dd className="font-serif text-2xl font-extrabold tabular-nums" data-testid="cost-current">
            {cost === null ? "Sin costo" : formatBs(cost)}
          </dd>
          {summary.costOrigin && <dd className="text-xs text-muted-foreground">{summary.costOrigin === "compra" ? "Última compra" : "Lo que ya tenías"}</dd>}
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Margen</dt>
          <dd className={margin !== null && margin < 0 ? "font-semibold text-rojo" : "font-semibold"} data-testid="cost-margin">
            {margin === null ? "—" : `${formatBs(margin)}${marginPct === null ? "" : ` (${marginPct} %)`}`}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Promedio de compras</dt>
          <dd className="font-semibold">{summary.averageUnitCostCents === null ? "—" : formatBs(summary.averageUnitCostCents)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">Vendidas · ganancia</dt>
          <dd className="font-semibold">
            {summary.sold.units} · {formatBs(summary.sold.profitCents)}
          </dd>
          {summary.sold.unitsWithoutCost > 0 && <dd className="text-xs text-muted-foreground">{summary.sold.unitsWithoutCost} vendidas sin costo</dd>}
        </div>
      </dl>

      {last && (
        <div className="grid gap-2 rounded-2xl bg-background/50 p-3">
          <p className="text-sm">
            Última compra: <strong>{last.supplierName}</strong> · {day.format(new Date(last.receivedAt))} · {last.quantity} u. a {formatBs(last.unitCostCents)} c/u
          </p>
          {last.supplierWhatsapp && (
            <Button asChild variant="outline" className="justify-self-start">
              <a
                href={buildWhatsAppLink(last.supplierWhatsapp, reorderMessage({ supplierContact: null, supplierName: last.supplierName, productName, quantity: last.quantity }))}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircleIcon data-icon="inline-start" />
                Pedir de nuevo por WhatsApp
              </a>
            </Button>
          )}
        </div>
      )}

      {summary.purchases.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Compras de este producto</summary>
          <ul className="mt-2 grid gap-1 text-sm">
            {summary.purchases.map((p) => (
              <li key={p.purchaseId}>
                <Link href={`/panel/compras/${p.purchaseId}`} className="underline-offset-4 hover:underline">
                  {p.receivedAt ? day.format(new Date(p.receivedAt)) : "Por llegar"} · {p.supplierName} · {p.quantity} u.
                  {p.unitCostCents !== null && <> · {formatBs(p.unitCostCents)} c/u</>}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const text = String(new FormData(e.currentTarget).get("initialCost") ?? "");
          startTransition(async () => {
            const result = await callAction(() => setInitialCostAction(productId, text));
            setStatus("error" in result ? { ok: false, text: result.error } : { ok: true, text: "Costo guardado" });
            if (!("error" in result)) router.refresh();
          });
        }}
      >
        <label className={`${field} flex-1 basis-56`}>
          Costo de lo que ya tenías (Bs)
          <input name="initialCost" inputMode="decimal" defaultValue={centsToBsText(summary.initialCostCents)} placeholder="del cuaderno" className={control} />
          <span className="text-xs font-normal text-muted-foreground">Se usa mientras no haya una compra registrada. No suma stock.</span>
        </label>
        <Button type="submit" variant="secondary" disabled={pending}>
          Guardar costo
        </Button>
      </form>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm font-medium text-verde" : "text-sm font-medium text-rojo"}>
          {status.text}
        </p>
      )}
    </section>
  );
}
