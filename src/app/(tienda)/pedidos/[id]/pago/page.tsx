import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/features/auth/session";
import { PaymentStep } from "@/features/orders/PaymentStep";
import { getOrderForCustomer, getPaymentMethods } from "@/features/orders/queries";
import { customerCanUploadProof, formatOrderCode } from "@/features/orders/status";

export const metadata: Metadata = { title: "Pagar pedido", robots: { index: false } };

async function PaymentContent({ params }: { params: PageProps<"/pedidos/[id]/pago">["params"] }) {
  const { id } = await params;
  const [user, order] = await Promise.all([getSessionUser(), getOrderForCustomer(id)]);
  if (!user || !order) notFound();
  if (!customerCanUploadProof(order.status)) redirect(`/pedidos/${order.id}`);
  const methods = await getPaymentMethods();
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
