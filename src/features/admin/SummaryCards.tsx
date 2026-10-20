import Link from "next/link";
import { ChevronRightIcon, ClockAlertIcon, PackagePlusIcon, StoreIcon } from "lucide-react";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { DashboardSummary } from "./queries";

const card = "flex min-h-28 flex-col justify-between gap-2 rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-5";
const big = "font-serif text-4xl font-extrabold tabular-nums leading-none";
const sales = (n: number) => (n === 1 ? "1 venta" : `${n} ventas`);

function LinkCard({ href, title, value, children, tone }: { href: string; title: string; value: number; children?: React.ReactNode; tone?: "alert" }) {
  return (
    <Link href={href} className={cn(card, "transition-colors hover:border-madera", tone === "alert" && "border-rojo/40 bg-rojo/5")}>
      <span className="flex items-center justify-between font-semibold text-tinta-suave">
        {title}
        <ChevronRightIcon aria-hidden className="size-5" />
      </span>
      <span className={big}>{value}</span>
      {children}
    </Link>
  );
}

function SalesCard({ title, cents, count, extra }: { title: string; cents: number; count: number; extra?: string }) {
  const id = `ventas-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <section aria-labelledby={id} className={card}>
      <h2 id={id} className="font-semibold text-tinta-suave">
        {title}
      </h2>
      <p className={big}>{formatBs(cents)}</p>
      <p className="text-sm text-muted-foreground">
        {sales(count)}
        {extra && <> · {extra}</>}
      </p>
    </section>
  );
}

/** Portada del panel: lo que hay que atender y cómo van las ventas (sin gráficos; eso es el plan 5). */
export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const s = summary;
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <Link href="/panel/productos/nuevo" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-verde px-3 text-center font-semibold text-crema hover:bg-verde-2">
          <PackagePlusIcon aria-hidden className="size-5 shrink-0" />
          Nuevo producto
        </Link>
        <Link href="/panel/productos?filtro=visibles" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-verde px-3 text-center font-semibold text-verde hover:bg-verde/10">
          <StoreIcon aria-hidden className="size-5 shrink-0" />
          Vendí en tienda
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <LinkCard href="/panel/pedidos" title="Por revisar" value={s.pendingReview} tone={s.pendingReviewOver24h > 0 ? "alert" : undefined}>
          {s.pendingReviewOver24h > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rojo">
              <ClockAlertIcon aria-hidden className="size-4" />
              {s.pendingReviewOver24h === 1 ? "1 lleva más de 24 h" : `${s.pendingReviewOver24h} llevan más de 24 h`}
            </span>
          )}
        </LinkCard>
        <LinkCard href="/panel/pedidos?tab=entregar" title="Por entregar" value={s.toDeliver} />
        <LinkCard href="/panel/productos?filtro=poco-stock" title="Poco stock" value={s.lowStock.length}>
          {s.lowStock.length > 0 && (
            <span className="line-clamp-2 text-sm text-muted-foreground">{s.lowStock.slice(0, 3).map((p) => `${p.name} (${p.stock})`).join(", ")}</span>
          )}
        </LinkCard>
        <LinkCard href="/panel/productos?filtro=agotados" title="Agotados" value={s.outOfStock} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <SalesCard title="Ventas de hoy" cents={s.salesToday.cents} count={s.salesToday.count} />
        <SalesCard title="Ventas del mes" cents={s.salesMonth.cents} count={s.salesMonth.count} extra={`Envíos cobrados: ${formatBs(s.shippingMonthCents)}`} />
      </div>
      <p className="text-sm text-muted-foreground">
        Ventas = productos de pedidos web con pago confirmado más las ventas en tienda y por WhatsApp. Los envíos se cuentan aparte.
      </p>
    </div>
  );
}
