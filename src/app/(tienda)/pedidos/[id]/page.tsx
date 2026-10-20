import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getStoreSettings } from "@/features/catalog/cached";
import { CancelOrderButton } from "@/features/orders/CancelOrderButton";
import { OrderTimeline } from "@/features/orders/OrderTimeline";
import { getOrderForCustomer, type OrderDetail } from "@/features/orders/queries";
import { customerCanCancel, customerCanUploadProof, formatOrderCode, STATUS_HINT } from "@/features/orders/status";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatBs } from "@/lib/money";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Detalle del pedido", robots: { index: false } };

function deliveryText(o: OrderDetail): string {
  if (o.deliveryMethod === "recojo") return "Recojo en tienda";
  if (o.deliveryMethod === "encomienda") return `Encomienda por bus a ${o.city}, ${o.department} (el envío se paga al recoger)`;
  if (o.zoneMode === "punto") return `Punto de encuentro: ${o.meetingPoint} (zona ${o.zoneName})`;
  return `A domicilio en ${o.zoneName}: ${o.address}${o.addressReference ? ` (${o.addressReference})` : ""}`;
}

async function OrderContent({ params }: { params: PageProps<"/pedidos/[id]">["params"] }) {
  const { id } = await params;
  const order = await getOrderForCustomer(id);
  if (!order) notFound();
  const settings = await getStoreSettings();
  const code = formatOrderCode(order.number);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Pedido {code}</h1>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 max-w-prose text-tinta-suave">{STATUS_HINT[order.status]}</p>

      {order.status === "rechazado" && order.rejectionReason && (
        <p className="mt-4 rounded-xl bg-rojo/10 px-4 py-3 font-medium text-rojo">Motivo: {order.rejectionReason}</p>
      )}

      <div className="mt-5 flex flex-wrap items-start gap-3">
        {customerCanUploadProof(order.status) && (
          <Button asChild size="lg">
            <Link href={`/pedidos/${order.id}/pago`}>{order.status === "rechazado" ? "Subir otra captura" : "Pagar ahora"}</Link>
          </Button>
        )}
        {settings.whatsappPhone && (
          <Button asChild size="lg" variant="outline">
            <a href={buildWhatsAppLink(settings.whatsappPhone, `Hola, consulto por mi pedido ${code}`)} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon data-icon="inline-start" />
              Consultar por WhatsApp
            </a>
          </Button>
        )}
        {customerCanCancel(order.status) && <CancelOrderButton orderId={order.id} />}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_18rem]">
        <div className="grid min-w-0 gap-8">
          <section>
            <h2 className="mb-3 font-serif text-xl font-bold">Productos</h2>
            <ul className="grid gap-2">
              {order.items.map((i, n) => (
                <li key={n} className="flex justify-between gap-3 rounded-xl bg-papel px-4 py-3">
                  <span className="min-w-0">
                    {i.productName} × {i.quantity}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatBs(i.unitPriceCents * i.quantity)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid gap-1 px-4 text-sm">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatBs(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Envío</dt>
                <dd className="tabular-nums">{order.deliveryMethod === "encomienda" ? "Por pagar" : formatBs(order.deliveryFeeCents)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatBs(order.totalCents)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl font-bold">Entrega</h2>
            <p>{deliveryText(order)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.recipientName}
              {order.recipientCi && <> · CI {order.recipientCi}</>} · {order.phone}
            </p>
            {(order.shippingAgency || order.trackingCode) && (
              <p className="mt-3 rounded-xl bg-papel px-4 py-3 text-sm">
                Enviado por <strong>{order.shippingAgency}</strong>
                {order.trackingCode && <> · Guía {order.trackingCode}</>}
              </p>
            )}
            {order.shippingProofUrl && (
              <p className="mt-2 text-sm">
                <a href={order.shippingProofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-verde underline-offset-4 hover:underline">
                  Ver comprobante del envío
                </a>
              </p>
            )}
            {order.invoice && (
              <p className="mt-3 text-sm">
                Factura a nombre de <strong>{order.invoice.name}</strong> · NIT/CI {order.invoice.nit}
              </p>
            )}
          </section>

          {order.proofs.length > 0 && (
            <section>
              <h2 className="mb-3 font-serif text-xl font-bold">Capturas enviadas</h2>
              <ul className="flex flex-wrap gap-3">
                {order.proofs.map((p, i) => (
                  <li key={p.url}>
                    <a href={p.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada que vence en 10 minutos */}
                      <img src={p.url} alt={`Captura ${i + 1}`} className="h-28 w-20 rounded-lg border border-border object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <section>
          <h2 className="mb-3 font-serif text-xl font-bold">Historial</h2>
          <OrderTimeline events={order.events} />
        </section>
      </div>

      <p className="mt-10">
        <Link href="/pedidos" className="font-semibold text-verde underline-offset-4 hover:underline">
          Ver todos mis pedidos
        </Link>
      </p>
    </>
  );
}

export default function PedidoPage({ params }: PageProps<"/pedidos/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <OrderContent params={params} />
      </Suspense>
    </div>
  );
}
