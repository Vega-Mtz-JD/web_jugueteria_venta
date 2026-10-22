import { createServerSupabase } from "@/lib/supabase/server";
import type { OrderStatus } from "@/features/orders/status";
import type { Period, Range } from "./period";
import type { Channel, SalesFilter } from "./sales-filter";

// Datos del dashboard y de la página Ventas. Todo se suma en la base (sales_lines / sales_totals).

export type SalesTotals = {
  salesCents: number;
  count: number;
  units: number;
  costCents: number;
  profitCents: number;
  withoutCostCents: number;
  withoutCostUnits: number;
  shippingCents: number;
};

export type Bar = { idx: number; kind: "dia" | "semana" | "mes"; from: string; to: string; salesCents: number; profitCents: number; withoutCostCents: number };

export type TopProduct = { productId: string; name: string; units: number; revenueCents: number; profitCents: number; unitsWithoutCost: number; stock: number };

export type DashboardSales = {
  period: Period;
  range: Range;
  current: SalesTotals;
  previous: SalesTotals;
  byChannel: Record<Channel, number>;
  bars: Bar[];
  top: TopProduct[];
  customers: { buyers: number; new: number; returning: number };
  ordersByStatus: Partial<Record<OrderStatus, number>>;
};

export type Reorder = { supplierName: string; contactName: string | null; whatsapp: string | null; quantity: number };
export type NamedProduct = { productId: string; name: string };

export type DashboardNow = {
  pendingReview: number;
  pendingReviewOver24h: number;
  toDeliver: number;
  purchasesToArrive: number;
  debt: { bobCents: number; usdCents: number };
  runningLow: {
    items: { productId: string; name: string; stock: number; sold30d: number; reorder: Reorder | null }[];
    lowStockCount: number;
    outOfStockCount: number;
  };
  inventory: {
    products: number;
    units: number;
    costValueCents: number;
    saleValueCents: number;
    potentialProfitCents: number;
    withoutCost: { products: number; units: number; items: NamedProduct[] };
    withoutPrice: { products: number; items: NamedProduct[] };
    samplesWithStock: number;
  };
};

export type SaleRow = {
  soldAt: string;
  channel: Channel;
  orderId: string | null;
  orderNumber: number | null;
  manualSaleId: string | null;
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  unitCostCents: number | null;
  profitCents: number | null;
};

export type SalesList = { range: Range; totals: SalesTotals; rowCount: number; rows: SaleRow[] };

export async function getDashboardSales(period: Period): Promise<DashboardSales> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_dashboard_sales", { p_period: period });
  if (error) throw error;
  return data as unknown as DashboardSales;
}

export async function getDashboardNow(): Promise<DashboardNow> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_dashboard_now");
  if (error) throw error;
  return data as unknown as DashboardNow;
}

export async function getSalesList(f: SalesFilter): Promise<SalesList> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_sales_list", {
    p_period: f.period ?? undefined,
    p_from: f.from ?? undefined,
    p_to: f.to ?? undefined,
    p_channel: f.channel ?? undefined,
    p_without_cost: f.withoutCost,
  });
  if (error) throw error;
  return data as unknown as SalesList;
}
