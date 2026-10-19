import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSessionUser } from "@/features/auth/session";
import { getStoreSettings } from "@/features/catalog/cached";
import { CheckoutForm } from "@/features/checkout/CheckoutForm";
import { getCheckoutOptions } from "@/features/checkout/queries";

export const metadata: Metadata = { title: "Finalizar compra", robots: { index: false } };

async function CheckoutContent() {
  const user = await getSessionUser();
  if (!user) redirect("/ingresar?siguiente=%2Fcheckout");
  const [options, store] = await Promise.all([getCheckoutOptions(), getStoreSettings()]);
  return <CheckoutForm options={options} store={store} defaults={{ name: user.fullName ?? "", phone: user.phone ?? "" }} />;
}

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight sm:text-4xl">Finalizar compra</h1>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <CheckoutContent />
      </Suspense>
    </div>
  );
}
