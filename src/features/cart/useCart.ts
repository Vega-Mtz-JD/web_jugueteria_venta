"use client";

import { useSyncExternalStore } from "react";
import { dispatchCart, getCartSnapshot, getServerCartSnapshot, subscribeCart, type CartLine } from "./cart-store";

export function useCart() {
  const lines: CartLine[] = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
  return {
    lines,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    add: (productId: string, quantity: number, maxStock: number) => dispatchCart({ type: "add", productId, quantity, maxStock }),
    setQuantity: (productId: string, quantity: number, maxStock: number) =>
      dispatchCart({ type: "setQuantity", productId, quantity, maxStock }),
    remove: (productId: string) => dispatchCart({ type: "remove", productId }),
    clear: () => dispatchCart({ type: "clear" }),
    reconcile: (available: Record<string, number>) => dispatchCart({ type: "reconcile", available }),
  };
}
