import { fetchOrderDetail, UUID, type OrderDetail } from "@/features/orders/queries";
import type { OrderStatus } from "@/features/orders/status";
import { createServerSupabase } from "@/lib/supabase/server";
import type { DeliveryMethod } from "./transitions";

// Consultas del panel. Todas usan la sesión del admin: RLS y las funciones admin_* deciden qué se ve.

const DAY_MS = 24 * 3600_000;

export type AdminTab = "revisar" | "entregar" | "historial";

export type AdminOrderRow = {
  id: string;
  number: number;
  status: OrderStatus;
  createdAt: string;
  statusChangedAt: string;
  totalCents: number;
  recipientName: string;
  deliveryMethod: DeliveryMethod;
  itemCount: number;
  /** En revisión desde hace más de 24 horas. */
  over24h: boolean;
};

function isOver24h(status: OrderStatus, statusChangedAt: string, now: number) {
  return status === "en_revision" && now - new Date(statusChangedAt).getTime() > DAY_MS;
}

/** Pedidos de una pestaña del panel (historial: hasta 100, con búsqueda por código o nombre). */
export async function listAdminOrders(tab: AdminTab, opts: { q?: string; status?: OrderStatus } = {}): Promise<AdminOrderRow[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("orders")
    .select("id, number, status, created_at, status_changed_at, total_cents, recipient_name, delivery_method, order_items(quantity)");

  if (tab === "revisar") {
    query = query.eq("status", "en_revision").order("status_changed_at", { ascending: true });
  } else if (tab === "entregar") {
    query = query.in("status", ["pagado", "enviado", "listo_para_recoger"]).order("status_changed_at", { ascending: true });
  } else {
    // Los que esperan el pago solo aparecen si se filtran a propósito (spec §5.3).
    query = opts.status ? query.eq("status", opts.status) : query.neq("status", "esperando_pago");
    const q = opts.q?.trim();
    if (q) {
      const number = /^#?(\d{1,9})$/.exec(q);
      query = number ? query.eq("number", Number(number[1])) : query.ilike("recipient_name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
    }
    query = query.order("created_at", { ascending: false }).limit(100);
  }

  const { data, error } = await query;
  if (error) throw error;
  const now = Date.now();
  return data.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status,
    createdAt: o.created_at,
    statusChangedAt: o.status_changed_at,
    totalCents: o.total_cents,
    recipientName: o.recipient_name,
    deliveryMethod: o.delivery_method,
    itemCount: o.order_items.reduce((sum, i) => sum + i.quantity, 0),
    over24h: isOver24h(o.status, o.status_changed_at, now),
  }));
}

export type AdminOrderDetail = OrderDetail & {
  customer: { email: string; fullName: string | null; phone: string | null } | null;
  over24h: boolean;
};

/** Detalle de cualquier pedido, con el contacto de quien compró. */
export async function getAdminOrder(orderId: string): Promise<AdminOrderDetail | null> {
  if (!UUID.test(orderId)) return null;
  const supabase = await createServerSupabase();
  const [order, contact] = await Promise.all([
    fetchOrderDetail(supabase, orderId),
    supabase.rpc("admin_customer_contact", { p_order_id: orderId }).maybeSingle(),
  ]);
  if (!order) return null;
  const c = contact.data;
  return {
    ...order,
    customer: c ? { email: c.email, fullName: c.full_name, phone: c.phone } : null,
    over24h: isOver24h(order.status, order.statusChangedAt, Date.now()),
  };
}
