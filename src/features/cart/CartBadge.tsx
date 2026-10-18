"use client";

import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { useCart } from "./useCart";

export function CartBadge() {
  const { count } = useCart();
  const label = count === 0 ? "Ver carrito (vacío)" : `Ver carrito (${count} ${count === 1 ? "producto" : "productos"})`;
  return (
    <Link
      href="/carrito"
      prefetch={false}
      aria-label={label}
      className="relative inline-flex size-11 items-center justify-center rounded-full bg-verde text-crema transition-colors hover:bg-verde-2"
    >
      <ShoppingBagIcon aria-hidden className="size-5" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-cubo-mostaza px-1 text-xs font-bold tabular-nums text-tinta"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
