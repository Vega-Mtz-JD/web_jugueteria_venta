import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRightIcon, PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/features/admin/purchases/money";
import { getPurchasesOverview, listPurchases, type Debt } from "@/features/admin/purchases/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compras" };

const STATUS = { encargada: "Encargada", recibida: "Recibida", anulada: "Anulada" } as const;
const day = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "UTC" });
const debtText = (d: Debt) => [d.BOB > 0 && formatMoney(d.BOB, "BOB"), d.USD > 0 && formatMoney(d.USD, "USD")].filter(Boolean).join(" · ");

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id={id} className="mb-3 font-serif text-xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function Overview() {
  const o = await getPurchasesOverview();
  return (
    <>
      <Section id="lo-que-debo" title="Lo que debo">
        {o.debts.length === 0 ? (
          <p className="text-muted-foreground">No le debes nada a ningún proveedor.</p>
        ) : (
          <>
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
              {o.debts.map((d) => (
                <li key={d.supplierId}>
                  <Link href={`/panel/proveedores/${d.supplierId}`} className="flex items-center justify-between gap-3 rounded-xl bg-background/50 px-4 py-3 hover:bg-crema-2">
                    <span className="min-w-0 truncate font-semibold">{d.name}</span>
                    <span className="shrink-0 font-serif text-lg font-bold tabular-nums text-rojo">{debtText(d.debt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right font-semibold">Total: {debtText(o.totals)}</p>
          </>
        )}
      </Section>
      <Section id="falta-llegar" title="Lo que falta llegar">
        {o.pending.length === 0 ? (
          <p className="text-muted-foreground">No hay compras esperando.</p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {o.pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-background/50 px-4 py-3">
                <Link href={`/panel/compras/${p.id}`} className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.supplierName}</span>
                  <span className="block text-sm text-muted-foreground">
                    {day.format(new Date(p.orderedOn))} · {p.daysWaiting === 1 ? "1 día" : `${p.daysWaiting} días`} esperando · {formatMoney(p.totalCents, p.currency)}
                  </span>
                </Link>
                <Button asChild>
                  <Link href={`/panel/compras/${p.id}?llego=1`}>Llegó</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}

async function History({ searchParams }: { searchParams: PageProps<"/panel/compras">["searchParams"] }) {
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.slice(0, 80) ?? "";
  const rows = await listPurchases({ q });
  return (
    <Section id="historial-compras" title="Historial">
      <form role="search" className="mb-3 flex gap-2">
        <label className="sr-only" htmlFor="buscar-compra">
          Buscar por proveedor o producto
        </label>
        <input
          id="buscar-compra"
          name="q"
          defaultValue={q}
          placeholder="Proveedor o producto"
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button type="submit" className="h-11 rounded-xl bg-verde px-5 font-semibold text-crema hover:bg-verde-2">
          Buscar
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">No hay compras.</p>
      ) : (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/panel/compras/${r.id}`} className="flex items-center gap-3 rounded-xl bg-background/50 px-4 py-3 hover:bg-crema-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{r.supplierName}</span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {day.format(new Date(r.orderedOn))} · {r.products}
                  </span>
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className={cn("block font-semibold", r.status === "anulada" && "text-muted-foreground line-through")}>{formatMoney(r.totalCents, r.currency)}</span>
                  <span className="block text-muted-foreground">{STATUS[r.status]}</span>
                </span>
                <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default function ComprasPage(props: PageProps<"/panel/compras">) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Compras</h1>
        <Button asChild size="lg">
          <Link href="/panel/compras/nueva">
            <PlusIcon data-icon="inline-start" />
            Nueva compra
          </Link>
        </Button>
      </div>
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-3xl bg-crema-2" />}>
        <Overview />
      </Suspense>
      <Suspense fallback={<div aria-hidden className="h-48 animate-pulse rounded-3xl bg-crema-2" />}>
        <History searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
