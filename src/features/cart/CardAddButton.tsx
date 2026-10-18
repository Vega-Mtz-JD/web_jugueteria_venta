"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCart } from "./useCart";

/** El "+" de las tarjetas: agrega una unidad sin salir de la lista. */
export function CardAddButton({ productId, name, stock, className }: { productId: string; name: string; stock: number; className?: string }) {
  const { lines, add } = useCart();
  const [done, setDone] = useState(false);
  const full = (lines.find((l) => l.productId === productId)?.quantity ?? 0) >= stock;
  return (
    <button
      type="button"
      aria-label={`Agregar «${name}» al carrito`}
      disabled={full}
      onClick={() => {
        add(productId, 1, stock);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className={cn(
        "relative z-10 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-verde text-crema outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40",
        className,
      )}
    >
      {done ? <CheckIcon aria-hidden className="size-5" /> : <PlusIcon aria-hidden className="size-5" />}
    </button>
  );
}
