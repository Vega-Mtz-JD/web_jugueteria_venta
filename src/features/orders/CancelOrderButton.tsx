"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cancelOrderAction } from "./actions";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button variant="ghost" className="text-rojo hover:bg-rojo/10" onClick={() => setConfirming(true)}>
        Cancelar pedido
      </Button>
    );
  }
  return (
    <div role="group" aria-label="Confirmar cancelación" className="grid gap-2 rounded-xl bg-rojo/5 p-3">
      <p className="text-sm font-medium">¿Seguro? El pedido se cancela y no se puede deshacer.</p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-rojo text-rojo hover:bg-rojo/10"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await cancelOrderAction(orderId);
              if ("error" in result) setError(result.error);
              else router.refresh();
            })
          }
        >
          {pending ? "Cancelando…" : "Sí, cancelar"}
        </Button>
        <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending}>
          No
        </Button>
      </div>
      {error && <p className="text-sm font-medium text-rojo">{error}</p>}
    </div>
  );
}
