import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchaseForm } from "@/features/admin/purchases/PurchaseForm";
import { getPurchaseFormData, todayLaPaz } from "@/features/admin/purchases/queries";

export const metadata: Metadata = { title: "Nueva compra" };

async function Form() {
  const data = await getPurchaseFormData();
  return <PurchaseForm suppliers={data.suppliers} products={data.products} categories={data.categories} today={todayLaPaz()} />;
}

export default function NuevaCompraPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Nueva compra</h1>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <Form />
      </Suspense>
    </div>
  );
}
