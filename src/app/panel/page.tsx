import Link from "next/link";
import { Suspense } from "react";
import { PackagePlusIcon, StoreIcon } from "lucide-react";
import { CustomersOrders } from "@/features/admin/dashboard/CustomersOrders";
import { InventoryCard } from "@/features/admin/dashboard/InventoryCard";
import { PendingCards } from "@/features/admin/dashboard/PendingCards";
import { PeriodTabs } from "@/features/admin/dashboard/PeriodTabs";
import { parsePeriod } from "@/features/admin/dashboard/period";
import { ProfitHero } from "@/features/admin/dashboard/ProfitHero";
import { getDashboardNow, getDashboardSales } from "@/features/admin/dashboard/queries";
import { RestockSection } from "@/features/admin/dashboard/RestockSection";

async function Dashboard({ searchParams }: { searchParams: PageProps<"/panel">["searchParams"] }) {
  const period = parsePeriod((await searchParams).periodo);
  const [sales, now] = await Promise.all([getDashboardSales(period), getDashboardNow()]);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <PeriodTabs current={period} hrefFor={(p) => `/panel?periodo=${p}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2 lg:items-start">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <ProfitHero data={sales} period={period} />
          <PendingCards now={now} />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <RestockSection top={sales.top} low={now.runningLow} />
          <InventoryCard inv={now.inventory} />
          <CustomersOrders data={sales} />
        </div>
      </div>
    </div>
  );
}

export default function PanelPage(props: PageProps<"/panel">) {
  return (
    <>
      <h1 className="mb-5 text-3xl font-extrabold tracking-tight">Panel</h1>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4">
        <Link href="/panel/productos/nuevo" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-verde px-3 text-center font-semibold text-crema hover:bg-verde-2">
          <PackagePlusIcon aria-hidden className="size-5 shrink-0" />
          Nuevo producto
        </Link>
        <Link href="/panel/productos?filtro=visibles" className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-verde px-3 text-center font-semibold text-verde hover:bg-verde/10">
          <StoreIcon aria-hidden className="size-5 shrink-0" />
          Vendí en tienda
        </Link>
      </div>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <Dashboard searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
