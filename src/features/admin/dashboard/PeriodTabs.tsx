import Link from "next/link";
import { cn } from "@/lib/utils";
import { PERIODS, type Period } from "./period";

/** Botones de período (enlaces): el elegido lleva aria-current. */
export function PeriodTabs({ current, hrefFor }: { current: Period | null; hrefFor: (p: Period) => string }) {
  return (
    <nav aria-label="Período" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={hrefFor(p.value)}
          aria-current={p.value === current ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#eadcc4] bg-papel px-4 font-semibold transition-colors hover:border-madera",
            p.value === current && "border-verde bg-verde text-crema hover:border-verde",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}
