import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebtText } from "@/features/admin/purchases/DebtText";
import { formatMoney } from "@/features/admin/purchases/money";
import { getSupplier } from "@/features/admin/purchases/queries";
import { SupplierForm } from "@/features/admin/purchases/SupplierForm";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Proveedor" };

const STATUS = { encargada: "Encargada", recibida: "Recibida", anulada: "Anulada" } as Record<string, string>;
const day = new Intl.DateTimeFormat("es-BO", { dateStyle: "medium", timeZone: "UTC" });

async function Supplier({ params }: { params: PageProps<"/panel/proveedores/[id]">["params"] }) {
  const { id } = await params;
  const s = await getSupplier(id);
  if (!s) notFound();
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{s.name}</h1>
        <p className="mt-1">
          <DebtText debt={s.debt} />
        </p>
      </div>
      {s.whatsapp && (
        <Button asChild size="lg" variant="outline" className="justify-self-start">
          <a href={buildWhatsAppLink(s.whatsapp, `Hola ${s.contactName ?? s.name}, te escribo de la tienda.`)} target="_blank" rel="noopener noreferrer">
            <MessageCircleIcon data-icon="inline-start" />
            Escribir por WhatsApp
          </a>
        </Button>
      )}
      <section className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
        <SupplierForm supplier={s} />
      </section>
      <section>
        <h2 className="mb-3 font-serif text-xl font-bold">Compras</h2>
        {s.purchases.length === 0 ? (
          <p className="text-muted-foreground">Todavía no hay compras a este proveedor.</p>
        ) : (
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-2">
            {s.purchases.map((p) => (
              <li key={p.id}>
                <Link href={`/panel/compras/${p.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-papel px-4 py-3 hover:bg-crema-2">
                  <span>
                    {day.format(new Date(p.orderedOn))} · {STATUS[p.status] ?? p.status}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(p.totalCents, p.currency)}
                    {p.debtCents > 0 && <span className="ml-2 text-rojo">debe {formatMoney(p.debtCents, p.currency)}</span>}
                    {p.debtCents < 0 && <span className="ml-2 text-verde">a favor {formatMoney(-p.debtCents, p.currency)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>
        <Link href="/panel/proveedores" className="inline-flex min-h-11 items-center gap-2 font-semibold text-verde underline-offset-4 hover:underline">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Volver a proveedores
        </Link>
      </p>
    </div>
  );
}

export default function ProveedorPage(props: PageProps<"/panel/proveedores/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
      <Supplier params={props.params} />
    </Suspense>
  );
}
