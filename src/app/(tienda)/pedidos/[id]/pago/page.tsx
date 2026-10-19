import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/features/auth/session";
import { getStoreSettings } from "@/features/catalog/cached";
import { PaymentStep } from "@/features/orders/PaymentStep";
import { getOrderForCustomer, getPaymentMethods } from "@/features/orders/queries";
import { customerCanUploadProof, formatOrderCode } from "@/features/orders/status";

export const metadata: Metadata = { title: "Pagar pedido", robots: { index: false } };

async function PaymentContent({ params }: { params: PageProps<"/pedidos/[id]/pago">["params"] }) {
  const { id } = await params;
  const [user, order] = await Promise.all([getSessionUser(), getOrderForCustomer(id)]);
  if (!user || !order) notFound();
  if (!customerCanUploadProof(order.status)) redirect(`/pedidos/${order.id}`);
  const [methods, settings] = await Promise.all([getPaymentMethods(), getStoreSettings()]);
  // Mismos plazos que expire_orders: 60 minutos sin pago, 48 horas tras un rechazo.
  const limitMs = order.status === "rechazado" ? 48 * 3600_000 : 60 * 60_000;
  const due = new Date(new Date(order.statusChangedAt).getTime() + limitMs);
  const fmt = new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    ...(order.status === "rechazado" ? { dateStyle: "long", timeStyle: "short" } : { hour: "numeric", minute: "2-digit" }),
  });
  const deadline = order.status === "rechazado" ? `el ${fmt.format(due)}` : `las ${fmt.format(due)}`;
  return (
    <>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Paga tu pedido {formatOrderCode(order.number)}</h1>
      <PaymentStep
        orderId={order.id}
        userId={user.id}
        code={formatOrderCode(order.number)}
        totalCents={order.totalCents}
        methods={methods}
        rejectionReason={order.status === "rechazado" ? order.rejectionReason : null}
        deadline={deadline}
        whatsappPhone={settings.whatsappPhone}
      />
    </>
  );
}

export default function PagoPage({ params }: PageProps<"/pedidos/[id]/pago">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <PaymentContent params={params} />
      </Suspense>
    </div>
  );
}
