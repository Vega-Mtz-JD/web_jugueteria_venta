import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PeriodTabs } from "@/features/admin/dashboard/PeriodTabs";
import { rangeLabel } from "@/features/admin/dashboard/period";
import { getSalesList } from "@/features/admin/dashboard/queries";
import { SalesTable } from "@/features/admin/dashboard/SalesTable";
import { CHANNELS, parseSalesFilter, salesHref, type SalesFilter } from "@/features/admin/dashboard/sales-filter";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Ventas" };

const chip = "inline-flex min-h-11 shrink-0 items-center rounded-full border border-[#eadcc4] bg-papel px-4 font-semibold transition-colors hover:border-madera";
const on = "border-verde bg-verde text-crema hover:border-verde";

async function Sales({ searchParams }: { searchParams: PageProps<"/panel/ventas">["searchParams"] }) {
  const filter = parseSalesFilter(await searchParams);
  const list = await getSalesList(filter);
  const keep = (f: Partial<SalesFilter>) => salesHref({ ...filter, ...f });
  return (
    <>
      <p className="mb-4 text-lg text-tinta-suave">{rangeLabel(list.range)}</p>
      <div className="grid gap-3">
        <PeriodTabs current={filter.period} hrefFor={(p) => salesHref({ period: p, channel: filter.channel, withoutCost: filter.withoutCost })} />
        <nav aria-label="Canal" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Link href={keep({ channel: null })} aria-current={filter.channel === null ? "page" : undefined} className={cn(chip, filter.channel === null && on)}>
            Todos
          </Link>
          {CHANNELS.map((c) => (
            <Link key={c.value} href={keep({ channel: c.value })} aria-current={filter.channel === c.value ? "page" : undefined} className={cn(chip, filter.channel === c.value && on)}>
              {c.label}
            </Link>
          ))}
          <Link href={keep({ withoutCost: !filter.withoutCost })} aria-pressed={filter.withoutCost} className={cn(chip, filter.withoutCost && "border-madera bg-madera/15")}>
            Solo sin costo
          </Link>
        </nav>
      </div>
      <div className="mt-5">
        <SalesTable list={list} />
      </div>
    </>
  );
}

export default function VentasPage(props: PageProps<"/panel/ventas">) {
  return (
    <>
      <h1 className="mb-2 text-3xl font-extrabold tracking-tight">Ventas</h1>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <Sales searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
