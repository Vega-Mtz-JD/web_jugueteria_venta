"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { voidManualSaleAction } from "../product-actions";
import type { StockMovement } from "../queries";

const when = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/La_Paz" });

function reasonLabel(m: StockMovement): string {
  switch (m.reason) {
    case "alta":
      return "Stock inicial";
    case "venta_web":
      return "Pedido web";
    case "devolucion_web":
      return "Devuelto de un pedido web";
    case "venta_manual":
      return m.sale?.channel === "whatsapp" ? "Venta por WhatsApp" : "Venta en tienda";
    case "anulacion_venta_manual":
      return "Venta anulada";
    case "compra":
      return "Compra";
    default:
      return m.note ?? "Ajuste";
  }
}

/** Historial de stock del producto, con "Anular" en las ventas manuales. */
export function MovementList({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) return <p className="text-muted-foreground">Todavía no hay movimientos.</p>;
  return (
    <ul className="grid gap-2">
      {movements.map((m) => (
        <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-papel px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {reasonLabel(m)}
              {m.sale?.voided && <span className="ml-2 text-sm font-normal text-muted-foreground">(anulada)</span>}
            </span>
            <span className="text-sm text-muted-foreground">{when.format(new Date(m.createdAt))}</span>
          </span>
          <span className={cn("font-serif text-lg font-bold tabular-nums", m.delta < 0 ? "text-rojo" : "text-verde")}>
            {m.delta > 0 ? `+${m.delta}` : `−${-m.delta}`}
          </span>
          {m.reason === "venta_manual" && m.sale && !m.sale.voided && <VoidSale saleId={m.sale.id} />}
        </li>
      ))}
    </ul>
  );
}

function VoidSale({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  if (!confirming) {
    return (
      <Button variant="ghost" className="text-rojo hover:bg-rojo/10" onClick={() => setConfirming(true)}>
        Anular
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Confirmar anulación" className="flex w-full flex-wrap items-center gap-2">
      <span className="text-sm">¿Anular esta venta? El stock vuelve.</span>
      <Button
        variant="outline"
        className="border-rojo text-rojo hover:bg-rojo/10"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await voidManualSaleAction(saleId);
            if ("error" in result) setError(result.error);
            else router.refresh();
          })
        }
      >
        Sí, anular
      </Button>
      <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
        No
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
