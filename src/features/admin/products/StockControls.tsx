"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { callAction } from "../call-action";
import { adjustStockAction } from "../product-actions";
import { CountShelfDialog } from "./CountShelfDialog";
import { ManualSaleDialog } from "./ManualSaleDialog";
import { reservedText } from "./reserved";

type Product = { id: string; name: string; priceCents: number; stock: number; reserved: number };

/** Stock disponible con − / + rápidos y el botón "Vendí". `full` agrega "Contar estante" (pantalla del producto). */
export function StockControls({ product, full = false }: { product: Product; full?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"vendi" | "contar" | null>(null);

  function adjust(delta: number) {
    startTransition(async () => {
      const result = await callAction(() => adjustStockAction(product.id, delta));
      if ("error" in result) return setError(result.error);
      setError(null);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="icon"
          aria-label={`Quitar una unidad a ${product.name}`}
          disabled={pending || product.stock === 0}
          onClick={() => adjust(-1)}
        >
          <MinusIcon aria-hidden />
        </Button>
        <p className="min-w-16 text-center leading-tight">
          <span data-testid="stock" className="block font-serif text-2xl font-extrabold tabular-nums">
            {product.stock}
          </span>
          <span className="text-xs text-muted-foreground">disponibles</span>
        </p>
        <Button variant="secondary" size="icon" aria-label={`Sumar una unidad a ${product.name}`} disabled={pending} onClick={() => adjust(1)}>
          <PlusIcon aria-hidden />
        </Button>
        {/* Activo aunque el stock sea 0: la base explica qué pedido tiene la unidad o pide corregir el stock. */}
        <Button className="ml-1" onClick={() => setDialog("vendi")} disabled={pending}>
          Vendí
        </Button>
        {full && (
          <Button variant="outline" onClick={() => setDialog("contar")} disabled={pending}>
            Contar estante
          </Button>
        )}
      </div>
      {product.reserved > 0 && (
        <p className="text-sm font-medium text-[#6b5210]">
          <Link href="/panel/pedidos?tab=historial" className="underline-offset-4 hover:underline">
            {reservedText(product.reserved, !full)}
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
      <ManualSaleDialog product={product} open={dialog === "vendi"} onOpenChange={(o) => setDialog(o ? "vendi" : null)} />
      {full && <CountShelfDialog product={product} open={dialog === "contar"} onOpenChange={(o) => setDialog(o ? "contar" : null)} />}
    </div>
  );
}
