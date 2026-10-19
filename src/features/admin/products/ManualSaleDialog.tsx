"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { recordManualSaleAction } from "../product-actions";
import { bsTextToCents, centsToBsText } from "../product-schema";
import { cn } from "@/lib/utils";

const field = "grid gap-1.5 text-sm font-semibold";

/** "Vendí": registra una venta en la tienda o por WhatsApp y descuenta el stock. */
export function ManualSaleDialog({
  product,
  open,
  onOpenChange,
}: {
  product: { id: string; name: string; priceCents: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState<"tienda" | "whatsapp">("tienda");

  function submit(form: FormData) {
    const unitPriceCents = bsTextToCents(String(form.get("price") ?? ""));
    const quantity = Number(form.get("quantity"));
    if (unitPriceCents === null) return setError("Escribe el precio de venta");
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return setError("La cantidad debe ser entre 1 y 100");
    startTransition(async () => {
      const result = await recordManualSaleAction({
        productId: product.id,
        quantity,
        channel,
        unitPriceCents,
        note: String(form.get("note") ?? ""),
      });
      if ("error" in result) return setError(result.error);
      setError(null);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError(null);
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogTitle>Vendí</DialogTitle>
        <DialogDescription>{product.name}</DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <label className={field}>
            Cantidad
            <Input name="quantity" type="number" inputMode="numeric" min={1} max={100} defaultValue={1} className="h-11 text-base font-normal" />
          </label>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Dónde se vendió</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["tienda", "whatsapp"] as const).map((c) => (
                <label
                  key={c}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 font-semibold",
                    channel === c ? "border-verde bg-verde/10 text-verde" : "border-input",
                  )}
                >
                  <input type="radio" name="channel" value={c} checked={channel === c} onChange={() => setChannel(c)} className="sr-only" />
                  {c === "tienda" ? "Tienda" : "WhatsApp"}
                </label>
              ))}
            </div>
          </fieldset>
          <label className={field}>
            Precio unitario (Bs)
            <Input name="price" inputMode="decimal" defaultValue={centsToBsText(product.priceCents)} className="h-11 text-base font-normal" />
          </label>
          <label className={field}>
            Nota (opcional)
            <Input name="note" maxLength={200} className="h-11 text-base font-normal" />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-rojo">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : "Registrar venta"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
