import Link from "next/link";
import { formatBs } from "@/lib/money";
import type { DashboardNow, NamedProduct } from "./queries";

function Missing({ title, items, total }: { title: string; items: NamedProduct[]; total: number }) {
  if (total === 0) return null;
  return (
    <details className="mt-2 rounded-xl bg-madera/10 px-3 py-2 text-sm">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <ul className="mt-2 grid gap-1">
        {items.map((p) => (
          <li key={p.productId}>
            <Link href={`/panel/productos/${p.productId}`} className="text-verde underline-offset-4 hover:underline">
              {p.name}
            </Link>
          </li>
        ))}
        {total > items.length && <li className="text-muted-foreground">y {total - items.length} más</li>}
      </ul>
    </details>
  );
}

/** Cuánto vale lo que hay en la tienda (disponible + apartado), sin los juegos de ejemplo. */
export function InventoryCard({ inv }: { inv: DashboardNow["inventory"] }) {
  const n = (v: number, one: string, many: string) => (v === 1 ? `1 ${one}` : `${v} ${many}`);
  return (
    <section aria-labelledby="inventario" className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id="inventario" className="mb-1 font-serif text-xl font-bold">
        Inventario
      </h2>
      <p className="text-tinta-suave">
        {n(inv.products, "juego", "juegos")} · {n(inv.units, "unidad", "unidades")}
      </p>
      <dl className="mt-3 grid gap-2">
        <div className="flex justify-between gap-3">
          <dt>Valor a costo</dt>
          <dd className="font-semibold tabular-nums">{formatBs(inv.costValueCents)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Valor a precio de venta</dt>
          <dd className="font-semibold tabular-nums">{formatBs(inv.saleValueCents)}</dd>
        </div>
        <div className="flex justify-between gap-3 border-t border-[#eadcc4] pt-2">
          <dt className="font-semibold">Si vendes todo, ganarías</dt>
          <dd className="font-serif text-xl font-extrabold tabular-nums text-verde">{formatBs(inv.potentialProfitCents)}</dd>
        </div>
      </dl>
      {(inv.withoutCost.products > 0 || inv.withoutPrice.products > 0) && (
        <p className="mt-1 text-sm text-muted-foreground">
          Solo cuenta los juegos con costo y precio: faltan {inv.withoutCost.products} sin costo y {inv.withoutPrice.products} sin precio.
        </p>
      )}
      <Missing
        title={`${n(inv.withoutCost.products, "juego", "juegos")} sin costo anotado (${n(inv.withoutCost.units, "unidad", "unidades")})`}
        items={inv.withoutCost.items}
        total={inv.withoutCost.products}
      />
      <Missing title={`${n(inv.withoutPrice.products, "juego", "juegos")} sin precio`} items={inv.withoutPrice.items} total={inv.withoutPrice.products} />
      {inv.samplesWithStock > 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          No se cuentan {inv.samplesWithStock} juegos de ejemplo; puedes borrarlos en{" "}
          <Link href="/panel/ajustes" className="text-verde underline-offset-4 hover:underline">
            Ajustes
          </Link>
          .
        </p>
      )}
    </section>
  );
}
