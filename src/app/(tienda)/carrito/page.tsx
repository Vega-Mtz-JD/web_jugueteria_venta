import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBagIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Carrito", robots: { index: false } };

// Página provisional hasta que llegue la compra en línea (plan 2).
export default function CarritoPage() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <span className="inline-flex size-16 items-center justify-center rounded-full bg-verde text-crema">
        <ShoppingBagIcon aria-hidden className="size-8" />
      </span>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">Tu carrito estará listo muy pronto</h1>
      <p className="mt-3 text-muted-foreground">
        Muy pronto podrás comprar aquí y pagar con QR. Mientras tanto, mira el catálogo y consúltanos por WhatsApp desde
        la ficha de cada juego.
      </p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/catalogo">Ver catálogo</Link>
      </Button>
    </div>
  );
}
