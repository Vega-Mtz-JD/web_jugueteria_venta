import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { OrderList } from "@/features/admin/orders/OrderList";
import { listAdminOrders, type AdminTab } from "@/features/admin/queries";
import { ADMIN_STATUS_LABEL, type OrderStatus } from "@/features/orders/status";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedidos" };

const TABS: { tab: AdminTab; label: string; empty: string }[] = [
  { tab: "revisar", label: "Por revisar", empty: "No hay pagos por revisar." },
  { tab: "entregar", label: "Por entregar", empty: "No hay pedidos por entregar." },
  { tab: "historial", label: "Historial", empty: "No encontramos pedidos." },
];

const STATUSES = Object.keys(ADMIN_STATUS_LABEL) as OrderStatus[];

async function OrdersTab({ searchParams }: { searchParams: PageProps<"/panel/pedidos">["searchParams"] }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const current = TABS.find((t) => t.tab === one(sp.tab)) ?? TABS[0];
  const q = one(sp.q)?.slice(0, 80) ?? "";
  const status = STATUSES.find((s) => s === one(sp.estado));
  const orders = await listAdminOrders(current.tab, { q, status });

  return (
    <>
      <nav aria-label="Pestañas de pedidos" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-crema-2 p-1">
        {TABS.map((t) => (
          <Link
            key={t.tab}
            href={t.tab === "revisar" ? "/panel/pedidos" : `/panel/pedidos?tab=${t.tab}`}
            aria-current={t.tab === current.tab ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-xl px-3 text-sm font-semibold",
              t.tab === current.tab ? "bg-papel text-verde shadow-sm" : "text-tinta-suave hover:text-tinta",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {current.tab === "historial" && (
        <form className="mb-5 flex flex-wrap gap-2" role="search">
          <input type="hidden" name="tab" value="historial" />
          <label className="sr-only" htmlFor="buscar-pedido">
            Buscar por código o nombre
          </label>
          <input
            id="buscar-pedido"
            name="q"
            defaultValue={q}
            placeholder="#0231 o nombre"
            className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-papel px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <label className="sr-only" htmlFor="filtro-estado">
            Estado
          </label>
          <select
            id="filtro-estado"
            name="estado"
            defaultValue={status ?? ""}
            className="h-11 rounded-xl border border-input bg-papel px-3 text-base"
          >
            <option value="">Todos los estados</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {ADMIN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button type="submit" className="h-11 rounded-xl bg-verde px-5 font-semibold text-crema hover:bg-verde-2">
            Buscar
          </button>
        </form>
      )}

      <OrderList orders={orders} empty={current.empty} />
    </>
  );
}

export default function PanelPedidosPage({ searchParams }: PageProps<"/panel/pedidos">) {
  return (
    <>
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Pedidos</h1>
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-3xl bg-crema-2" />}>
        <OrdersTab searchParams={searchParams} />
      </Suspense>
    </>
  );
}
