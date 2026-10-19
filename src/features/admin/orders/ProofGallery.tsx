"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/** Capturas del pago: miniaturas que se abren a pantalla completa para revisar el monto. */
export function ProofGallery({ proofs }: { proofs: { url: string; createdAt: string }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (proofs.length === 0) return <p className="text-muted-foreground">Todavía no hay capturas.</p>;
  const current = open === null ? null : proofs[open];
  return (
    <>
      <ul className="flex flex-wrap gap-3">
        {proofs.map((p, i) => (
          <li key={p.url}>
            <button
              type="button"
              onClick={() => setOpen(i)}
              className="block overflow-hidden rounded-xl border border-border focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              aria-label={`Ampliar captura ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que vence en 10 minutos */}
              <img src={p.url} alt="" className="h-48 w-32 object-cover sm:h-56 sm:w-40" />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={current !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="inset-0 max-h-none rounded-none bg-tinta p-2 pt-14 sm:inset-0 sm:top-0 sm:left-0 sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none [&>button]:bg-papel">
          <DialogTitle className="sr-only">Captura {open !== null ? open + 1 : ""}</DialogTitle>
          {current && (
            // eslint-disable-next-line @next/next/no-img-element -- URL firmada
            <img src={current.url} alt={`Captura ${(open ?? 0) + 1}`} className="mx-auto max-h-[calc(100dvh-4.5rem)] w-auto object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
