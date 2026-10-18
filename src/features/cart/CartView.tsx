"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ProductCardData } from "@/features/catalog/types";
import { formatBs } from "@/lib/money";
import { getCartProducts } from "./actions";
import { cartReducer, MAX_PER_LINE } from "./cart-store";
import { QuantityStepper } from "./QuantityStepper";
import { useCart } from "./useCart";

export function CartView() {
  const { lines, setQuantity, remove, reconcile } = useCart();
  const [products, setProducts] = useState<Record<string, ProductCardData> | null>(null);
  const [adjusted, setAdjusted] = useState<string[]>([]);
  const ids = lines.map((l) => l.productId).sort().join(",");

  // Al abrir el carrito (o cambiar qué productos tiene) se traen precio y stock al día.
  useEffect(() => {
    let cancelled = false;
    const current = lines;
    getCartProducts(current.map((l) => l.productId)).then((fresh) => {
      if (cancelled) return;
      const byId = Object.fromEntries(fresh.map((p) => [p.id, p]));
      const available = Object.fromEntries(fresh.map((p) => [p.id, p.stock]));
      const next = cartReducer(current, { type: "reconcile", available });
      const changed = current.filter((l) => next.find((n) => n.productId === l.productId)?.quantity !== l.quantity);
      if (changed.length > 0) {
        setAdjusted(changed.map((l) => byId[l.productId]?.name ?? "un producto que ya no está disponible"));
        reconcile(available);
      }
      setProducts(byId);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el conjunto de productos
  }, [ids]);

  if (lines.length === 0 && adjusted.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-input bg-papel px-6 py-14 text-center">
        <p className="font-serif text-xl font-bold">Tu carrito está vacío</p>
        <p className="mt-2 text-muted-foreground">Mira el catálogo y agrega los juegos que te gusten.</p>
        <Button asChild className="mt-6">
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }

  const visible = products ? lines.filter((l) => products[l.productId]) : [];
  const subtotal = visible.reduce((sum, l) => sum + products![l.productId].priceCents * l.quantity, 0);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div>
        {adjusted.length > 0 && (
          <p role="status" className="mb-4 rounded-xl bg-mostaza/15 px-4 py-3 text-sm font-medium">
            Ajustamos tu carrito: {adjusted.map((n) => `«${n}»`).join(", ")} ya no tiene stock suficiente.
          </p>
        )}
        {lines.length === 0 ? (
          <p className="text-muted-foreground">
            Tu carrito quedó vacío.{" "}
            <Link href="/catalogo" className="font-semibold text-verde underline underline-offset-4">
              Ver catálogo
            </Link>
          </p>
        ) : !products ? (
          <div aria-hidden className="h-32 animate-pulse rounded-2xl bg-crema-2" />
        ) : (
          <ul className="grid gap-3">
            {visible.map((line) => {
              const p = products[line.productId];
              const max = Math.min(p.stock, MAX_PER_LINE);
              return (
                <li key={p.id} data-testid="cart-line" className="flex gap-3 rounded-2xl border border-[#eadcc4] bg-papel p-3">
                  <Link href={`/producto/${p.slug}`} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-crema-2 sm:size-24">
                    <Image src={p.imageUrl} alt="" fill sizes="96px" unoptimized={p.imageUrl.endsWith(".svg")} className="object-contain p-2" />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/producto/${p.slug}`} className="line-clamp-2 font-serif font-semibold hover:underline">
                        {p.name}
                      </Link>
                      <button
                        type="button"
                        aria-label={`Quitar «${p.name}»`}
                        onClick={() => remove(p.id)}
                        className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-crema-2 hover:text-rojo"
                      >
                        <Trash2Icon aria-hidden className="size-4" />
                      </button>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                      <QuantityStepper value={line.quantity} max={max} onChange={(n) => setQuantity(p.id, n, p.stock)} />
                      <span className="font-bold tabular-nums">{formatBs(p.priceCents * line.quantity)}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {lines.length > 0 && products && (
        <aside className="h-fit rounded-3xl bg-crema-2 p-5 md:sticky md:top-24">
          <h2 className="text-xl font-bold">Resumen</h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd className="font-semibold tabular-nums">{formatBs(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>Envío</dt>
              <dd>Se calcula en el siguiente paso</dd>
            </div>
          </dl>
          <Button asChild size="lg" className="mt-5 w-full">
            <Link href="/checkout">Continuar con la compra</Link>
          </Button>
          <p className="mt-3 text-xs text-muted-foreground">Para pagar te pediremos ingresar o crear tu cuenta.</p>
        </aside>
      )}
    </div>
  );
}
