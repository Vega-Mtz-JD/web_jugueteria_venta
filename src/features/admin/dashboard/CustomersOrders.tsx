import Link from "next/link";
import { ADMIN_STATUS_LABEL, type OrderStatus } from "@/features/orders/status";
import type { DashboardSales } from "./queries";

const box = "rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-background/50 px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="font-serif text-2xl font-extrabold tabular-nums">{value}</dd>
    </div>
  );
}

/** Clientes de la tienda web y pedidos creados en el período, por estado. */
export function CustomersOrders({ data }: { data: DashboardSales }) {
  const statuses = (Object.keys(ADMIN_STATUS_LABEL) as OrderStatus[]).filter((s) => (data.ordersByStatus[s] ?? 0) > 0);
  return (
    <>
      <section aria-labelledby="clientes" className={box}>
        <h2 id="clientes" className="mb-1 font-serif text-xl font-bold">
          Clientes
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Solo cuenta la tienda web</p>
        <dl className="grid grid-cols-3 gap-2">
          <Stat label="Compraron" value={data.customers.buyers} />
          <Stat label="Nuevos" value={data.customers.new} />
          <Stat label="Volvieron a comprar" value={data.customers.returning} />
        </dl>
      </section>
      <section aria-labelledby="pedidos-estado" className={box}>
        <h2 id="pedidos-estado" className="mb-3 font-serif text-xl font-bold">
          Pedidos
        </h2>
        {statuses.length === 0 ? (
          <p className="text-muted-foreground">No hay pedidos nuevos en este período.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <li key={s}>
                <Link
                  href={`/panel/pedidos?tab=historial&estado=${s}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background/50 px-3 text-sm hover:bg-crema-2"
                >
                  {ADMIN_STATUS_LABEL[s]} <span className="font-bold tabular-nums">{data.ordersByStatus[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
