import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon } from "lucide-react";
import { centsToBsText } from "@/features/admin/product-schema";
import { formatMoney } from "@/features/admin/purchases/money";
import { PurchaseActions, PurchaseNotes, VoidPaymentButton } from "@/features/admin/purchases/PurchaseActions";
import { PurchaseForm } from "@/features/admin/purchases/PurchaseForm";
import { getPurchase, getPurchaseFormData, todayLaPaz } from "@/features/admin/purchases/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Compra" };

const STATUS = { encargada: "Encargada", recibida: "Recibida", anulada: "Anulada" } as const;
const KIND = { pago: "Pago", devolucion: "Devolución del proveedor", saldo_usado: "Saldo usado en otra compra", saldo_recibido: "Saldo de otra compra" } as const;
const day = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "UTC" });

async function Purchase({ params, searchParams }: PageProps<"/panel/compras/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const p = await getPurchase(id);
  if (!p) notFound();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const warning = one(sp.aviso);

  if (one(sp.editar) === "1" && p.status === "encargada") {
    const data = await getPurchaseFormData();
    return (
      <div className="max-w-3xl">
        <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Corregir compra</h1>
        <PurchaseForm
          suppliers={data.suppliers}
          products={data.products}
          categories={data.categories}
          today={todayLaPaz()}
          initial={{
            id: p.id,
            supplierId: p.supplier.id,
            orderedOn: p.orderedOn,
            currency: p.currency,
            note: p.note ?? "",
            lines: p.items.map((i) => ({ productId: i.productId, quantity: i.quantityOrdered, unitPriceText: centsToBsText(i.unitPriceCents) })),
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold tracking-tight">Compra a {p.supplier.name}</h1>
          <span data-testid="purchase-status" className="rounded-full bg-crema-2 px-3 py-1 text-sm font-semibold">
            {STATUS[p.status]}
          </span>
        </div>
        <p className="mt-1 text-muted-foreground">
          Encargada el {day.format(new Date(p.orderedOn))} · en {p.currency === "BOB" ? "bolivianos" : "dólares"}
          {p.status === "encargada" && (
            <>
              {" · "}
              <Link href={`/panel/compras/${p.id}?editar=1`} className="font-semibold text-verde underline">
                Corregir
              </Link>
            </>
          )}
        </p>
      </div>
      {warning && (
        <p role="alert" className="rounded-xl bg-rojo/10 px-4 py-3 font-medium text-rojo">
          {warning}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 sm:max-w-xl">
        <div className="rounded-2xl bg-papel p-4">
          <dt className="text-sm text-muted-foreground">Total</dt>
          <dd className="font-serif text-2xl font-extrabold tabular-nums">{formatMoney(p.totalCents, p.currency)}</dd>
        </div>
        <div className="rounded-2xl bg-papel p-4">
          <dt className="text-sm text-muted-foreground">Pagado</dt>
          <dd className="font-serif text-2xl font-extrabold tabular-nums">{formatMoney(p.paidCents, p.currency)}</dd>
        </div>
      </dl>
      {p.status !== "anulada" && (
        <p data-testid="purchase-balance" className={cn("text-lg font-bold", p.debtCents > 0 ? "text-rojo" : "text-verde")}>
          {p.debtCents > 0 ? `Se debe: ${formatMoney(p.debtCents, p.currency)}` : p.debtCents < 0 ? `Saldo a favor: ${formatMoney(-p.debtCents, p.currency)}` : "Al día"}
        </p>
      )}

      <PurchaseActions purchase={p} openArrival={one(sp.llego) === "1"} />

      <section>
        <h2 className="mb-3 font-serif text-xl font-bold">Productos</h2>
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
          {p.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-papel px-4 py-3">
              <span className="min-w-0">
                <Link href={`/panel/productos/${i.productId}`} className="font-semibold underline-offset-4 hover:underline">
                  {i.productName}
                </Link>
                {!i.productVisible && <span className="ml-2 rounded-full bg-tinta/10 px-2 py-0.5 text-xs font-semibold">Oculto</span>}
                <span className="block text-sm text-muted-foreground">
                  Encargaste {i.quantityOrdered}
                  {i.quantityReceived !== null && <> · llegaron {i.quantityReceived}</>} · {formatMoney(i.unitPriceCents, p.currency)} c/u
                </span>
              </span>
              {i.unitCostCents !== null && <span className="text-sm font-semibold">Costo real: {formatMoney(i.unitCostCents, "BOB")} c/u</span>}
            </li>
          ))}
        </ul>
        {p.status === "recibida" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Encomienda: {formatMoney(p.shippingCents, "BOB")}
            {p.arrivalRate !== null && <> · dólar al llegar: {String(p.arrivalRate).replace(".", ",")}</>}
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-bold">Pagos</h2>
        {p.payments.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay pagos.</p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {p.payments.map((x) => (
              <li key={x.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-xl bg-papel px-4 py-3", x.voided && "opacity-60")}>
                <span className="min-w-0">
                  <span className={cn("block font-semibold", x.voided && "line-through")}>
                    {KIND[x.kind]}: {formatMoney(Math.abs(x.amountCents), x.currency)}
                    {x.rate !== null && x.currency !== p.currency && <> = {formatMoney(Math.abs(x.amountPurchaseCents), p.currency)}</>}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {day.format(new Date(x.paidOn))}
                    {x.rate !== null && <> · dólar a {String(x.rate).replace(".", ",")}</>}
                    {x.note && <> · {x.note}</>}
                    {x.voided && <> · anulado</>}
                  </span>
                </span>
                {!x.voided && p.status !== "anulada" && <VoidPaymentButton paymentId={x.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-serif text-xl font-bold">Notas</h2>
        <PurchaseNotes purchase={p} />
      </section>

      <p>
        <Link href="/panel/compras" className="inline-flex min-h-11 items-center gap-2 font-semibold text-verde underline-offset-4 hover:underline">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Volver a compras
        </Link>
      </p>
    </div>
  );
}

export default function CompraPage(props: PageProps<"/panel/compras/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
      <Purchase {...props} />
    </Suspense>
  );
}
