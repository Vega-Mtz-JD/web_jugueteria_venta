"use client";

import { CheckIcon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_PER_LINE } from "./cart-store";
import { QuantityStepper } from "./QuantityStepper";
import { useCart } from "./useCart";

/** Botón de la ficha de producto, con cantidad. */
export function AddToCartButton({ productId, stock }: { productId: string; stock: number }) {
  const { lines, add } = useCart();
  const inCart = lines.find((l) => l.productId === productId)?.quantity ?? 0;
  const room = Math.max(0, Math.min(stock, MAX_PER_LINE) - inCart);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 2500);
    return () => clearTimeout(t);
  }, [added]);

  if (stock === 0) {
    return (
      <Button size="lg" disabled className="sm:flex-1">
        <ShoppingBagIcon data-icon="inline-start" />
        Agotado
      </Button>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-1">
      <div className="flex flex-wrap gap-3">
        {room > 1 && <QuantityStepper value={Math.min(quantity, room)} max={room} onChange={setQuantity} />}
        <Button
          size="lg"
          className="min-w-44 flex-1"
          disabled={room === 0}
          onClick={() => {
            add(productId, Math.min(quantity, room), stock);
            setQuantity(1);
            setAdded(true);
          }}
        >
          <ShoppingBagIcon data-icon="inline-start" />
          Agregar al carrito
        </Button>
      </div>
      <p aria-live="polite" className="min-h-5 text-sm">
        {added ? (
          <span className="inline-flex items-center gap-1 font-semibold text-verde">
            <CheckIcon aria-hidden className="size-4" /> Agregado.{" "}
            <Link href="/carrito" className="underline underline-offset-4">
              Ver carrito
            </Link>
          </span>
        ) : room === 0 ? (
          <span className="text-muted-foreground">Ya tienes en el carrito todo el stock disponible.</span>
        ) : null}
      </p>
    </div>
  );
}
