import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listOrdersForCustomer } from "@/features/orders/queries";
import { formatOrderCode } from "@/features/orders/status";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatBs } from "@/lib/money";

export const metadata: Metadata = { title: "Mis pedidos", robots: { index: false } };

const day = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "America/La_Paz" });

async function OrdersList() {
  const orders = await listOrdersForCustomer();
  if (orders.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-input bg-papel px-6 py-14 text-center">
        <p className="font-serif text-xl font-bold">Todavía no hiciste pedidos</p>
        <p className="mt-2 text-muted-foreground">Cuando compres, aquí verás el estado de cada pedido.</p>
        <Button asChild className="mt-6">
          <Link href="/catalogo">Ver catálogo</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="grid gap-3">
      {orders.map((o) => (
        <li key={o.id}>
          <Link
            href={`/pedidos/${o.id}`}
            className="flex items-center gap-4 rounded-2xl border border-[#eadcc4] bg-papel p-4 transition-colors hover:border-madera"
          >
            <div className="min-w-0 flex-1">
              <p className="font-serif text-lg font-bold">Pedido {formatOrderCode(o.number)}</p>
              <p className="text-sm text-muted-foreground">
                {day.format(new Date(o.createdAt))} · {o.itemCount === 1 ? "1 producto" : `${o.itemCount} productos`} ·{" "}
                {formatBs(o.totalCents)}
              </p>
            </div>
            <StatusBadge status={o.status} />
            <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PedidosPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Mis pedidos</h1>
      <Suspense fallback={<div aria-hidden className="h-48 animate-pulse rounded-3xl bg-crema-2" />}>
        <OrdersList />
      </Suspense>
    </div>
  );
}
