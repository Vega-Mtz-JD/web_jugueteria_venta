import Link from "next/link";
import { ChevronRightIcon, ClockAlertIcon } from "lucide-react";
import { formatMoney } from "@/features/admin/purchases/money";
import { cn } from "@/lib/utils";
import type { DashboardNow } from "./queries";

const card = "flex min-h-28 flex-col justify-between gap-2 rounded-3xl border border-[#eadcc4] bg-papel p-4 transition-colors hover:border-madera";
const big = "font-serif text-3xl font-extrabold tabular-nums leading-none";

function Card({ href, title, alert, children }: { href: string; title: string; alert?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(card, alert && "border-rojo/40 bg-rojo/5")}>
      <span className="flex items-center justify-between gap-2 font-semibold text-tinta-suave">
        {title}
        <ChevronRightIcon aria-hidden className="size-5 shrink-0" />
      </span>
      {children}
    </Link>
  );
}

/** Lo pendiente: siempre "ahora", no depende del período. */
export function PendingCards({ now }: { now: DashboardNow }) {
  const owes = now.debt.bobCents > 0 || now.debt.usdCents > 0;
  return (
    <section aria-labelledby="pendiente">
      <h2 id="pendiente" className="mb-3 font-serif text-xl font-bold">
        Pendiente
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Card href="/panel/pedidos" title="Por revisar" alert={now.pendingReviewOver24h > 0}>
          <span className={big}>{now.pendingReview}</span>
          {now.pendingReviewOver24h > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-rojo">
              <ClockAlertIcon aria-hidden className="size-4" />
              {now.pendingReviewOver24h === 1 ? "1 lleva más de 24 h" : `${now.pendingReviewOver24h} llevan más de 24 h`}
            </span>
          )}
        </Card>
        <Card href="/panel/pedidos?tab=entregar" title="Por entregar">
          <span className={big}>{now.toDeliver}</span>
        </Card>
        <Card href="/panel/compras" title="Compras por llegar">
          <span className={big}>{now.purchasesToArrive}</span>
        </Card>
        <Card href="/panel/compras" title="Debes a proveedores" alert={owes}>
          {owes ? (
            <span className={cn("grid gap-1 font-serif text-xl font-extrabold tabular-nums leading-none text-rojo")}>
              {now.debt.bobCents > 0 && <span>{formatMoney(now.debt.bobCents, "BOB")}</span>}
              {now.debt.usdCents > 0 && <span>{formatMoney(now.debt.usdCents, "USD")}</span>}
            </span>
          ) : (
            <span className={big}>Bs 0</span>
          )}
        </Card>
      </div>
    </section>
  );
}
