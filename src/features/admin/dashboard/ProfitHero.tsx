import Link from "next/link";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { compareLine } from "./compare";
import { previousLabel, profitTitle, type Period } from "./period";
import { ProfitBars } from "./ProfitBars";
import type { DashboardSales } from "./queries";
import { CHANNELS, salesHref } from "./sales-filter";

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);
const TONE = { up: "text-verde", down: "text-rojo", same: "text-tinta-suave", neutral: "text-muted-foreground" } as const;
const link = "font-semibold text-verde underline-offset-4 hover:underline";

/** Arriba de la portada: cuánto ganó, comparado con el período anterior, con sus barras. */
export function ProfitHero({ data, period }: { data: DashboardSales; period: Period }) {
  const cur = data.current;
  const cmp = compareLine(cur, data.previous, previousLabel(period, data.range));
  return (
    <section aria-label="Ganancia" className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <Link href={salesHref({ period })} className="group block">
        <span className="block font-semibold text-tinta-suave">{profitTitle(period, data.range)}</span>
        <span className={cn("block font-serif text-5xl font-extrabold tabular-nums leading-tight group-hover:underline", cur.profitCents < 0 && "text-rojo")}>
          {formatBs(cur.profitCents)}
        </span>
      </Link>
      <p className={cn("mt-1 font-semibold", TONE[cmp.tone])}>{cmp.text}</p>

      <ProfitBars bars={data.bars} />

      <p className="mt-4">
        <Link href={salesHref({ period })} className={link}>
          Vendiste {formatBs(cur.salesCents)} ({plural(cur.count, "venta", "ventas")}, {plural(cur.units, "juego", "juegos")})
        </Link>{" "}
        · te costaron {formatBs(cur.costCents)}
      </p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {CHANNELS.map((c) => (
          <Link key={c.value} href={salesHref({ period, channel: c.value })} className="underline-offset-4 hover:underline">
            {c.label} <span className="font-semibold tabular-nums">{formatBs(data.byChannel[c.value])}</span>
          </Link>
        ))}
        <span className="text-muted-foreground">Envíos cobrados: {formatBs(cur.shippingCents)}</span>
      </p>
      {cur.withoutCostCents > 0 && (
        <p className="mt-3 rounded-xl bg-madera/10 px-3 py-2 text-sm">
          <Link href={salesHref({ period, withoutCost: true })} className="font-semibold underline-offset-4 hover:underline">
            {formatBs(cur.withoutCostCents)} en ventas sin costo anotado
          </Link>
          : no entran en la ganancia
        </p>
      )}
    </section>
  );
}
