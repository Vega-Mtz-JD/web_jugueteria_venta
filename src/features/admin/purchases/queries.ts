import { createServerSupabase } from "@/lib/supabase/server";
import type { Currency } from "./money";

// Consultas de compras y proveedores (solo admin: RLS y funciones admin_* deciden qué se ve).

export type Debt = { BOB: number; USD: number };
const noDebt = (): Debt => ({ BOB: 0, USD: 0 });

/** Lo que se debe por proveedor (solo deudas positivas, separadas por moneda). */
async function debtsBySupplier(): Promise<Map<string, Debt>> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("purchase_balances").select("supplier_id, currency, debt_cents").gt("debt_cents", 0);
  if (error) throw error;
  const out = new Map<string, Debt>();
  for (const r of data) {
    const d = out.get(r.supplier_id!) ?? noDebt();
    d[r.currency as Currency] += Number(r.debt_cents);
    out.set(r.supplier_id!, d);
  }
  return out;
}

export type SupplierRow = { id: string; name: string; contactName: string | null; whatsapp: string | null; isActive: boolean; debt: Debt };

export async function listSuppliers(): Promise<SupplierRow[]> {
  const supabase = await createServerSupabase();
  const [{ data, error }, debts] = await Promise.all([
    supabase.from("suppliers").select("id, name, contact_name, whatsapp, is_active").order("is_active", { ascending: false }).order("name"),
    debtsBySupplier(),
  ]);
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    name: s.name,
    contactName: s.contact_name,
    whatsapp: s.whatsapp,
    isActive: s.is_active,
    debt: debts.get(s.id) ?? noDebt(),
  }));
}

export type SupplierPurchase = { id: string; orderedOn: string; status: string; currency: Currency; totalCents: number; debtCents: number };
export type SupplierDetail = SupplierRow & { notes: string | null; purchases: SupplierPurchase[] };

export async function getSupplier(id: string): Promise<SupplierDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createServerSupabase();
  const [{ data: s }, { data: purchases }, { data: balances }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
    supabase.from("purchases").select("id, ordered_on, status, currency").eq("supplier_id", id).order("ordered_on", { ascending: false }).limit(50),
    supabase.from("purchase_balances").select("id, total_cents, debt_cents, currency").eq("supplier_id", id),
  ]);
  if (!s) return null;
  const byId = new Map((balances ?? []).map((b) => [b.id!, b]));
  const debt = noDebt();
  for (const b of balances ?? []) if (Number(b.debt_cents) > 0) debt[b.currency as Currency] += Number(b.debt_cents);
  return {
    id: s.id,
    name: s.name,
    contactName: s.contact_name,
    whatsapp: s.whatsapp,
    isActive: s.is_active,
    notes: s.notes,
    debt,
    purchases: (purchases ?? []).map((p) => ({
      id: p.id,
      orderedOn: p.ordered_on,
      status: p.status,
      currency: p.currency as Currency,
      totalCents: Number(byId.get(p.id)?.total_cents ?? 0),
      debtCents: Number(byId.get(p.id)?.debt_cents ?? 0),
    })),
  };
}

// Compras ----------------------------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Hoy en La Paz (YYYY-MM-DD). */
export function todayLaPaz(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" });
}

function daysBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
}

export type PendingPurchase = { id: string; supplierName: string; orderedOn: string; daysWaiting: number; currency: Currency; totalCents: number };
export type PurchasesOverview = { debts: { supplierId: string; name: string; debt: Debt }[]; totals: Debt; pending: PendingPurchase[] };

/** Portada de Compras: lo que debo (por proveedor y moneda) y lo que falta llegar. */
export async function getPurchasesOverview(): Promise<PurchasesOverview> {
  const supabase = await createServerSupabase();
  const [{ data: balances, error }, { data: suppliers }, { data: pending }] = await Promise.all([
    supabase.from("purchase_balances").select("id, supplier_id, currency, status, total_cents, debt_cents"),
    supabase.from("suppliers").select("id, name"),
    supabase.from("purchases").select("id, supplier_id, ordered_on, currency").eq("status", "encargada").order("ordered_on"),
  ]);
  if (error) throw error;
  const names = new Map((suppliers ?? []).map((s) => [s.id, s.name]));
  const totals = noDebt();
  const bySupplier = new Map<string, Debt>();
  for (const b of balances ?? []) {
    const debt = Number(b.debt_cents);
    if (debt <= 0) continue;
    const d = bySupplier.get(b.supplier_id!) ?? noDebt();
    d[b.currency as Currency] += debt;
    totals[b.currency as Currency] += debt;
    bySupplier.set(b.supplier_id!, d);
  }
  const totalById = new Map((balances ?? []).map((b) => [b.id!, Number(b.total_cents)]));
  const today = todayLaPaz();
  return {
    debts: [...bySupplier.entries()]
      .map(([supplierId, debt]) => ({ supplierId, name: names.get(supplierId) ?? "", debt }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    totals,
    pending: (pending ?? []).map((p) => ({
      id: p.id,
      supplierName: names.get(p.supplier_id) ?? "",
      orderedOn: p.ordered_on,
      daysWaiting: daysBetween(p.ordered_on, today),
      currency: p.currency as Currency,
      totalCents: totalById.get(p.id) ?? 0,
    })),
  };
}

export type PurchaseRow = {
  id: string;
  supplierName: string;
  orderedOn: string;
  status: "encargada" | "recibida" | "anulada";
  currency: Currency;
  totalCents: number;
  debtCents: number;
  products: string;
};

/** Historial: las 100 últimas, con buscador por proveedor o producto. */
export async function listPurchases({ q }: { q?: string } = {}): Promise<PurchaseRow[]> {
  const supabase = await createServerSupabase();
  const [{ data, error }, { data: balances }] = await Promise.all([
    supabase
      .from("purchases")
      .select("id, ordered_on, status, currency, created_at, suppliers(name), purchase_items(products(name))")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("purchase_balances").select("id, total_cents, debt_cents"),
  ]);
  if (error) throw error;
  const byId = new Map((balances ?? []).map((b) => [b.id!, b]));
  const needle = q?.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return data
    .map((p) => ({
      id: p.id,
      supplierName: p.suppliers?.name ?? "",
      orderedOn: p.ordered_on,
      status: p.status as PurchaseRow["status"],
      currency: p.currency as Currency,
      totalCents: Number(byId.get(p.id)?.total_cents ?? 0),
      debtCents: Number(byId.get(p.id)?.debt_cents ?? 0),
      products: p.purchase_items.map((i) => i.products?.name ?? "").join(", "),
    }))
    .filter((p) => !needle || `${p.supplierName} ${p.products}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(needle));
}

export type PurchaseItem = {
  id: string;
  productId: string;
  productName: string;
  productVisible: boolean;
  quantityOrdered: number;
  quantityReceived: number | null;
  unitPriceCents: number;
  unitCostCents: number | null;
};
export type PurchasePayment = {
  id: string;
  paidOn: string;
  currency: Currency;
  amountCents: number;
  rate: number | null;
  amountPurchaseCents: number;
  kind: "pago" | "devolucion" | "saldo_usado" | "saldo_recibido";
  note: string | null;
  voided: boolean;
};
export type PurchaseDetail = {
  id: string;
  supplier: { id: string; name: string; contactName: string | null; whatsapp: string | null };
  orderedOn: string;
  currency: Currency;
  status: PurchaseRow["status"];
  arrivalRate: number | null;
  shippingCents: number;
  note: string | null;
  issuesNote: string | null;
  receivedAt: string | null;
  items: PurchaseItem[];
  payments: PurchasePayment[];
  totalCents: number;
  paidCents: number;
  debtCents: number;
  /** Otras compras del mismo proveedor que deben algo (destino del saldo a favor). */
  creditTargets: { id: string; orderedOn: string; currency: Currency; debtCents: number }[];
};

export async function getPurchase(id: string): Promise<PurchaseDetail | null> {
  if (!UUID.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data: p } = await supabase
    .from("purchases")
    .select("*, suppliers(id, name, contact_name, whatsapp), purchase_items(*, products(name, is_active)), purchase_payments(*)")
    .eq("id", id)
    .maybeSingle();
  if (!p || !p.suppliers) return null;
  const [{ data: balance }, { data: others }] = await Promise.all([
    supabase.from("purchase_balances").select("total_cents, paid_cents, debt_cents").eq("id", id).maybeSingle(),
    supabase.from("purchase_balances").select("id, debt_cents, currency").eq("supplier_id", p.supplier_id).gt("debt_cents", 0).neq("id", id),
  ]);
  const { data: otherDates } = others?.length
    ? await supabase.from("purchases").select("id, ordered_on").in("id", others.map((o) => o.id!))
    : { data: [] };
  const dateOf = new Map((otherDates ?? []).map((o) => [o.id, o.ordered_on]));
  const total = Number(balance?.total_cents ?? 0);
  const paid = Number(balance?.paid_cents ?? 0);
  return {
    id: p.id,
    supplier: { id: p.suppliers.id, name: p.suppliers.name, contactName: p.suppliers.contact_name, whatsapp: p.suppliers.whatsapp },
    orderedOn: p.ordered_on,
    currency: p.currency as Currency,
    status: p.status as PurchaseRow["status"],
    arrivalRate: p.arrival_rate === null ? null : Number(p.arrival_rate),
    shippingCents: p.shipping_cents ?? 0,
    note: p.note,
    issuesNote: p.issues_note,
    receivedAt: p.received_at,
    items: [...p.purchase_items]
      .sort((a, b) => (a.products?.name ?? "").localeCompare(b.products?.name ?? ""))
      .map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.products?.name ?? "",
        productVisible: i.products?.is_active ?? false,
        quantityOrdered: i.quantity_ordered,
        quantityReceived: i.quantity_received,
        unitPriceCents: i.unit_price_cents,
        unitCostCents: i.line_cost_cents !== null && i.quantity_received ? Math.round(Number(i.line_cost_cents) / i.quantity_received) : null,
      })),
    payments: [...p.purchase_payments]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((x) => ({
        id: x.id,
        paidOn: x.paid_on,
        currency: x.currency as Currency,
        amountCents: x.amount_cents,
        rate: x.rate === null ? null : Number(x.rate),
        amountPurchaseCents: x.amount_purchase_cents,
        kind: x.kind as PurchasePayment["kind"],
        note: x.note,
        voided: x.voided_at !== null,
      })),
    totalCents: total,
    paidCents: paid,
    debtCents: total - paid,
    creditTargets: (others ?? []).map((o) => ({ id: o.id!, orderedOn: dateOf.get(o.id!) ?? "", currency: o.currency as Currency, debtCents: Number(o.debt_cents) })),
  };
}

/** Lo que necesita el formulario de compra. */
export async function getPurchaseFormData() {
  const supabase = await createServerSupabase();
  const [suppliers, products, categories] = await Promise.all([
    supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
  ]);
  return { suppliers: suppliers.data ?? [], products: products.data ?? [], categories: categories.data ?? [] };
}
