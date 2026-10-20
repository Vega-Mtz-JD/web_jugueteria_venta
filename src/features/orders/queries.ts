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
  statusChangedAt: string;
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
  /** Foto del comprobante de la encomienda (URL firmada), si el admin la subió. */
  shippingProofUrl: string | null;
};

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

async function currentUserId(supabase: Supabase): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORDER_DETAIL_SELECT =
  "*, delivery_zones(name), meeting_points(name), order_items(product_name, unit_price_cents, quantity), order_events(to_status, actor, note, created_at), payment_proofs(path, created_at)" as const;

/** Un pedido con su detalle (RLS decide quién lo ve; el filtro de dueño lo pone quien llama). */
export async function fetchOrderDetail(supabase: Supabase, orderId: string, customerId?: string): Promise<OrderDetail | null> {
  let query = supabase.from("orders").select(ORDER_DETAIL_SELECT).eq("id", orderId);
  if (customerId) query = query.eq("customer_id", customerId);
  const { data: o } = await query.maybeSingle();
  if (!o) return null;

  const proofs = [...(o.payment_proofs ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const [signed, shipping] = await Promise.all([
    proofs.length
      ? supabase.storage.from("payment-proofs").createSignedUrls(proofs.map((p) => p.path), 600).then((r) => r.data ?? [])
      : [],
    o.shipping_proof_path
      ? supabase.storage.from("shipping-proofs").createSignedUrl(o.shipping_proof_path, 600).then((r) => r.data?.signedUrl ?? null)
      : null,
  ]);

  return {
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.created_at,
    statusChangedAt: o.status_changed_at,
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
    shippingProofUrl: shipping,
  };
}

/** Pedido del usuario con sesión; null si no existe o es de otra persona (RLS). */
export async function getOrderForCustomer(orderId: string): Promise<OrderDetail | null> {
  if (!UUID.test(orderId)) return null;
  const supabase = await createServerSupabase();
  const uid = await currentUserId(supabase);
  if (!uid) return null;
  // Filtro explícito por dueño: con RLS, una cuenta admin vería pedidos ajenos como propios.
  return fetchOrderDetail(supabase, orderId, uid);
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
  const uid = await currentUserId(supabase);
  if (!uid) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("id, number, status, created_at, total_cents, order_items(quantity)")
    .eq("customer_id", uid)
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
