import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/features/catalog/cached";
import { supabaseEnv } from "@/lib/supabase/env";
import { createPublicSupabase } from "@/lib/supabase/public";
import { createServerSupabase } from "@/lib/supabase/server";
import type { OrderStatus } from "./status";

export type OrderDetail = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  deliveryMethod: "recojo" | "envio_ciudad" | "encomienda";
  zoneName: string | null;
  zoneMode: "domicilio" | "punto" | null;
  address: string | null;
  addressReference: string | null;
  meetingPoint: string | null;
  recipientName: string;
  recipientCi: string | null;
  phone: string;
  department: string | null;
  city: string | null;
  invoice: { nit: string; name: string } | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  rejectionReason: string | null;
  shippingAgency: string | null;
  trackingCode: string | null;
  items: { productName: string; unitPriceCents: number; quantity: number }[];
  events: { toStatus: OrderStatus; actor: string; note: string | null; createdAt: string }[];
  proofs: { url: string; createdAt: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pedido del usuario con sesión; null si no existe o es de otra persona (RLS). */
export async function getOrderForCustomer(orderId: string): Promise<OrderDetail | null> {
  if (!UUID.test(orderId)) return null;
  const supabase = await createServerSupabase();
  const { data: o } = await supabase
    .from("orders")
    .select(
      "*, delivery_zones(name), meeting_points(name), order_items(product_name, unit_price_cents, quantity), order_events(to_status, actor, note, created_at), payment_proofs(path, created_at)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (!o) return null;

  const proofs = [...(o.payment_proofs ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const signed = proofs.length
    ? (await supabase.storage.from("payment-proofs").createSignedUrls(proofs.map((p) => p.path), 600)).data ?? []
    : [];

  return {
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.created_at,
    deliveryMethod: o.delivery_method,
    zoneName: o.delivery_zones?.name ?? null,
    zoneMode: o.zone_mode,
    address: o.address,
    addressReference: o.address_reference,
    meetingPoint: o.meeting_points?.name ?? o.meeting_point_custom,
    recipientName: o.recipient_name,
    recipientCi: o.recipient_ci,
    phone: o.phone,
    department: o.department,
    city: o.city,
    invoice: o.invoice_requested && o.invoice_nit && o.invoice_name ? { nit: o.invoice_nit, name: o.invoice_name } : null,
    subtotalCents: o.subtotal_cents,
    deliveryFeeCents: o.delivery_fee_cents,
    totalCents: o.total_cents,
    rejectionReason: o.rejection_reason,
    shippingAgency: o.shipping_agency,
    trackingCode: o.tracking_code,
    items: o.order_items.map((i) => ({ productName: i.product_name, unitPriceCents: i.unit_price_cents, quantity: i.quantity })),
    events: [...o.order_events]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ toStatus: e.to_status, actor: e.actor, note: e.note, createdAt: e.created_at })),
    proofs: proofs.map((p, i) => ({ url: signed[i]?.signedUrl ?? "", createdAt: p.created_at })).filter((p) => p.url),
  };
}

export type PaymentMethod = { name: string; qrUrl: string; accountHolder: string | null };

/** Billeteras QR activas (datos públicos). */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const { data, error } = await createPublicSupabase().from("payment_methods").select("name, qr_path, account_holder").order("sort_order");
  if (error) throw error;
  const { url } = supabaseEnv();
  return data.map((m) => ({
    name: m.name,
    qrUrl: m.qr_path.startsWith("/") ? m.qr_path : `${url}/storage/v1/object/public/store-assets/${m.qr_path}`,
    accountHolder: m.account_holder,
  }));
}

export type OrderSummary = { id: string; number: number; status: OrderStatus; createdAt: string; totalCents: number; itemCount: number };

/** Pedidos del usuario con sesión, del más reciente al más antiguo. */
export async function listOrdersForCustomer(): Promise<OrderSummary[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, status, created_at, total_cents, order_items(quantity)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.created_at,
    totalCents: o.total_cents,
    itemCount: o.order_items.reduce((sum, i) => sum + i.quantity, 0),
  }));
}
