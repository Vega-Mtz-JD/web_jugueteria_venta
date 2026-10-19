import type { Metadata } from "next";
import { CartView } from "@/features/cart/CartView";

export const metadata: Metadata = { title: "Carrito", robots: { index: false } };

export default function CarritoPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Tu carrito</h1>
      <CartView />
    </div>
  );
}
