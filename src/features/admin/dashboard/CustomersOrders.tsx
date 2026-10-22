import type { OrderStatus } from "@/features/orders/status";
import type { DashboardSales } from "./queries";

const box = "rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6";

// Grupos del spec §4.6. Sin enlaces: el número es de los pedidos creados en el período y la lista de Pedidos
// no filtra por fecha, así que mostraría otra cantidad.
const GROUPS: { label: string; statuses: OrderStatus[] }[] = [
  { label: "Esperando pago", statuses: ["esperando_pago"] },
  { label: "En revisión", statuses: ["en_revision"] },
  { label: "Pagado", statuses: ["pagado"] },
  { label: "Enviado o listo", statuses: ["enviado", "listo_para_recoger"] },
  { label: "Entregado", statuses: ["entregado"] },
  { label: "Cancelado o rechazado", statuses: ["cancelado", "rechazado"] },
  { label: "Reembolsado", statuses: ["reembolsado"] },
];

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
  const groups = GROUPS.map((g) => ({ label: g.label, n: g.statuses.reduce((sum, st) => sum + (data.ordersByStatus[st] ?? 0), 0) })).filter((g) => g.n > 0);
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
        <h2 id="pedidos-estado" className="mb-1 font-serif text-xl font-bold">
          Pedidos
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">Creados en este período</p>
        {groups.length === 0 ? (
          <p className="text-muted-foreground">No hay pedidos nuevos en este período.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <li key={g.label} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background/50 px-3 text-sm">
                {g.label}
                <span className="font-bold tabular-nums">{g.n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
