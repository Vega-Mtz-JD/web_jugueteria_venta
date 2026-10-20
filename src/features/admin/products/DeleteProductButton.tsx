"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { callAction } from "../call-action";
import { deleteProductAction } from "../product-actions";

/** Borra el producto; si ya tuvo ventas, la base solo lo oculta. */
export function DeleteProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <div className="grid gap-2">
        <Button variant="ghost" className="justify-self-start text-rojo hover:bg-rojo/10" onClick={() => setConfirming(true)}>
          Borrar producto
        </Button>
        {message && (
          <p role="status" className="text-sm font-medium">
            {message}
          </p>
        )}
      </div>
    );
  }
  return (
    <div role="group" aria-label="Confirmar borrado" className="grid gap-2 rounded-xl bg-rojo/5 p-3">
      <p className="text-sm font-medium">¿Borrar este producto? Si ya tuvo ventas, solo se oculta de la tienda.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-rojo text-rojo hover:bg-rojo/10"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await callAction(() => deleteProductAction(productId));
              if ("error" in result) {
                setMessage(result.error);
              } else if (result.outcome === "borrado") {
                router.push("/panel/productos?borrado=1");
                return;
              } else {
                setMessage("Se ocultó porque tiene ventas");
                router.refresh();
              }
              setConfirming(false);
            })
          }
        >
          {pending ? "Borrando…" : "Sí, borrar"}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          No
        </Button>
      </div>
    </div>
  );
}
