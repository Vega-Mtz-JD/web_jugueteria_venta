"use client";

import { useEffect, useState } from "react";
import type { ProductCardData } from "@/features/catalog/types";
import { getCartProducts } from "./actions";
import { cartReducer, type CartLine } from "./cart-store";
import { useCart } from "./useCart";

/**
 * Trae precio y stock al día de lo que hay en el carrito y lo ajusta si algo ya no está
 * (agotado, sin stock suficiente o fuera de venta). `adjusted` nombra lo que cambió.
 */
export function useCartProducts() {
  const cart = useCart();
  const [products, setProducts] = useState<Record<string, ProductCardData> | null>(null);
  const [adjusted, setAdjusted] = useState<string[]>([]);
  const ids = cart.lines.map((l) => l.productId).sort().join(",");

  const apply = (current: CartLine[], fresh: ProductCardData[]) => {
    const byId = Object.fromEntries(fresh.map((p) => [p.id, p]));
    const available = Object.fromEntries(fresh.map((p) => [p.id, p.stock]));
    const next = cartReducer(current, { type: "reconcile", available });
    const changed = current.filter((l) => next.find((n) => n.productId === l.productId)?.quantity !== l.quantity);
    if (changed.length > 0) {
      setAdjusted(changed.map((l) => byId[l.productId]?.name ?? "un producto que ya no está a la venta"));
      cart.reconcile(available);
    }
    setProducts(byId);
  };

  const refresh = () => {
    const current = cart.lines;
    return getCartProducts(current.map((l) => l.productId)).then((fresh) => apply(current, fresh));
  };

  useEffect(() => {
    let cancelled = false;
    const current = cart.lines;
    getCartProducts(current.map((l) => l.productId)).then((fresh) => {
      if (!cancelled) apply(current, fresh);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia el conjunto de productos
  }, [ids]);

  const visible = products ? cart.lines.filter((l) => products[l.productId]) : [];
  const subtotal = products ? visible.reduce((sum, l) => sum + products[l.productId].priceCents * l.quantity, 0) : 0;
  return { ...cart, products, visible, subtotal, adjusted, refresh };
}
