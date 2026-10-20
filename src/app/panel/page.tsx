import { Suspense } from "react";
import { SummaryCards } from "@/features/admin/SummaryCards";
import { getDashboardSummary } from "@/features/admin/queries";

async function Summary() {
  return <SummaryCards summary={await getDashboardSummary()} />;
}

export default function PanelPage() {
  return (
    <>
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Panel</h1>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <Summary />
      </Suspense>
    </>
  );
}
