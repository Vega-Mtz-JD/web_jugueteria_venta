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
