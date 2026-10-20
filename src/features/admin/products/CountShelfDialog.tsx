"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { callAction } from "../call-action";
import { countShelfAction } from "../product-actions";

/** "Contar estante": el dueño escribe lo que ve y la base descuenta lo apartado en pedidos. */
export function CountShelfDialog({
  product,
  open,
  onOpenChange,
}: {
  product: { id: string; name: string; reserved: number };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(form: FormData) {
    const counted = Number(form.get("counted"));
    if (String(form.get("counted") ?? "").trim() === "" || !Number.isInteger(counted) || counted < 0) {
      return setError("Escribe cuántas unidades contaste");
    }
    startTransition(async () => {
      const result = await callAction(() => countShelfAction(product.id, counted));
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
        <DialogTitle>Contar estante</DialogTitle>
        <DialogDescription>
          Cuenta las unidades de «{product.name}» que hay en la tienda.
          {product.reserved > 0 && <> Lo apartado en pedidos ({product.reserved}) se descuenta solo.</>}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Unidades contadas
            <Input name="counted" type="number" inputMode="numeric" min={0} className="h-11 text-base font-normal" />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-rojo">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : "Guardar conteo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
