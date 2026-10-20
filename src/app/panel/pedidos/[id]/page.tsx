import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon, ClockAlertIcon, MessageCircleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderActions } from "@/features/admin/orders/OrderActions";
import { ProofGallery } from "@/features/admin/orders/ProofGallery";
import { getAdminOrder, type AdminOrderDetail } from "@/features/admin/queries";
import { getStoreSettings } from "@/features/catalog/cached";
import { OrderTimeline } from "@/features/orders/OrderTimeline";
import { ADMIN_STATUS_LABEL, formatOrderCode } from "@/features/orders/status";
import { StatusBadge } from "@/features/orders/StatusBadge";
import { formatBs } from "@/lib/money";
import { buildWhatsAppLink } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Pedido" };

function deliveryText(o: AdminOrderDetail): string {
  if (o.deliveryMethod === "recojo") return "Recojo en tienda";
  if (o.deliveryMethod === "encomienda") return `Encomienda por bus a ${o.city}, ${o.department} · CI ${o.recipientCi}`;
  if (o.zoneMode === "punto") return `Punto de encuentro: ${o.meetingPoint} (zona ${o.zoneName})`;
  return `A domicilio en ${o.zoneName}: ${o.address}${o.addressReference ? ` (${o.addressReference})` : ""}`;
}

async function AdminOrder({ params }: { params: PageProps<"/panel/pedidos/[id]">["params"] }) {
  const { id } = await params;
  const order = await getAdminOrder(id);
  if (!order) notFound();
  const settings = await getStoreSettings();
  const code = formatOrderCode(order.number);
  const firstName = order.recipientName.split(" ")[0];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Pedido {code}</h1>
        <StatusBadge status={order.status} labels={ADMIN_STATUS_LABEL} data-testid="order-status" />
      </div>
      {order.over24h && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-rojo/10 px-3 py-2 font-semibold text-rojo">
          <ClockAlertIcon aria-hidden className="size-5" />
          Hace más de 24 h que espera la revisión
        </p>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-2xl bg-papel p-4">
          <dt className="text-sm text-muted-foreground">Monto a buscar</dt>
          <dd className="font-serif text-3xl font-extrabold tabular-nums">{formatBs(order.totalCents)}</dd>
        </div>
        <div className="rounded-2xl bg-papel p-4">
          <dt className="text-sm text-muted-foreground">Código</dt>
          <dd className="font-serif text-3xl font-extrabold">{code}</dd>
        </div>
      </dl>

      <section className="mt-6">
        <h2 className="mb-3 font-serif text-xl font-bold">Capturas del pago</h2>
        <ProofGallery proofs={order.proofs} />
      </section>

      <div className="mt-6">
        <OrderActions orderId={order.id} status={order.status} method={order.deliveryMethod} />
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
                <dt>Productos</dt>
                <dd className="tabular-nums">{formatBs(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Envío</dt>
                <dd className="tabular-nums">{order.deliveryMethod === "encomienda" ? "Lo paga al recoger" : formatBs(order.deliveryFeeCents)}</dd>
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
              Recibe {order.recipientName} · {order.phone}
            </p>
            {(order.shippingAgency || order.trackingCode) && (
              <p className="mt-3 rounded-xl bg-papel px-4 py-3 text-sm">
                Enviado por <strong>{order.shippingAgency}</strong>
                {order.trackingCode && <> · Guía {order.trackingCode}</>}
                {order.shippingProofUrl && (
                  <>
                    {" · "}
                    <a href={order.shippingProofUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-verde underline">
                      Ver comprobante
                    </a>
                  </>
                )}
              </p>
            )}
            {order.invoice && (
              <p className="mt-3 text-sm">
                Factura a nombre de <strong>{order.invoice.name}</strong> · NIT/CI {order.invoice.nit}
              </p>
            )}
            {order.rejectionReason && order.status === "rechazado" && (
              <p className="mt-3 text-sm font-medium text-rojo">Motivo del rechazo: {order.rejectionReason}</p>
            )}
          </section>

          <section>
            <h2 className="mb-3 font-serif text-xl font-bold">Cliente</h2>
            {order.customer && (
              <p>
                {order.customer.fullName ?? order.recipientName} · <span className="break-all">{order.customer.email}</span>
                {order.customer.phone && <> · {order.customer.phone}</>}
              </p>
            )}
            <Button asChild size="lg" variant="outline" className="mt-3">
              <a
                href={buildWhatsAppLink(order.phone, `Hola ${firstName}, te escribimos de ${settings.storeName} por tu pedido ${code}`)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircleIcon data-icon="inline-start" />
                Escribir al cliente por WhatsApp
              </a>
            </Button>
          </section>
        </div>

        <section>
          <h2 className="mb-3 font-serif text-xl font-bold">Historial</h2>
          <OrderTimeline events={order.events} labels={ADMIN_STATUS_LABEL} />
        </section>
      </div>

      <p className="mt-10">
        <Link href="/panel/pedidos" className="inline-flex min-h-11 items-center gap-2 font-semibold text-verde underline-offset-4 hover:underline">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Volver a pedidos
        </Link>
      </p>
    </>
  );
}

export default function PanelPedidoPage({ params }: PageProps<"/panel/pedidos/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
      <AdminOrder params={params} />
    </Suspense>
  );
}
