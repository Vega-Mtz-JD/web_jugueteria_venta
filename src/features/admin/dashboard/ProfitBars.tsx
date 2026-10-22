import Link from "next/link";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { barScale } from "./bars";
import { barLabel } from "./period";
import type { Bar } from "./queries";
import { salesHref } from "./sales-filter";

const short = (cents: number) => formatBs(cents).replace("Bs ", "");

/** Barras de ganancia hechas a mano: cada una lleva a la lista de ventas de su día, semana o mes. */
export function ProfitBars({ bars }: { bars: Bar[] }) {
  const scale = barScale(bars.map((b) => b.profitCents));
  const hasNegative = scale.some((s) => s.negative);
  return (
    <ol aria-label="Ganancia por período" className="mt-4 flex gap-1 sm:gap-2">
      {bars.map((b, i) => {
        const s = scale[i];
        const current = i === bars.length - 1;
        const label = barLabel(b.kind, b.from, b.idx);
        return (
          <li key={b.idx} className="min-w-0 flex-1">
            <Link
              href={salesHref({ from: b.from, to: b.to })}
              aria-label={`${label}: ${formatBs(b.profitCents)} de ganancia`}
              className="group flex flex-col items-stretch rounded-lg px-0.5 pt-1 hover:bg-crema-2"
            >
              <span aria-hidden className="truncate text-center text-[11px] font-semibold tabular-nums text-tinta-suave sm:text-xs">
                {short(b.profitCents)}
              </span>
              <span aria-hidden className="flex h-28 items-end">
                {!s.negative && (
                  <span
                    className={cn("w-full rounded-t-md", current ? "bg-verde" : "bg-verde/35 group-hover:bg-verde/55")}
                    style={{ height: `${Math.max(s.pct, b.profitCents > 0 ? 2 : 0)}%` }}
                  />
                )}
              </span>
              {hasNegative && (
                <span aria-hidden className="flex h-8 items-start border-t border-tinta-suave/30">
                  {s.negative && <span className="w-full rounded-b-md bg-rojo/70" style={{ height: `${Math.max(s.pct, 4)}%` }} />}
                </span>
              )}
              <span aria-hidden className={cn("mt-1 text-center text-[11px] leading-tight break-words sm:text-xs", current ? "font-bold text-tinta" : "text-muted-foreground")}>
                {label}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
