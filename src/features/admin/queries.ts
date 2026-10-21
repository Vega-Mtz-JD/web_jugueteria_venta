import { fetchOrderDetail, UUID, type OrderDetail } from "@/features/orders/queries";
import type { OrderStatus } from "@/features/orders/status";
import { productImageUrl } from "@/lib/images";
import { supabaseEnv } from "@/lib/supabase/env";
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

// Productos -------------------------------------------------------------------------------------------

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

/** Unidades apartadas por pedidos web, por producto. */
async function reservedByProduct(supabase: Supabase): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("admin_reserved_units");
  if (error) throw error;
  return new Map(data.map((r) => [r.product_id, r.quantity]));
}

export type ProductFilter = "todos" | "visibles" | "ocultos" | "agotados" | "poco-stock";

export type AdminProductRow = {
  id: string;
  slug: string;
  name: string;
  categoryName: string;
  priceCents: number;
  stock: number;
  reserved: number;
  isActive: boolean;
  imageUrl: string;
};

/** Productos del panel (visibles y ocultos), con buscador y filtros. */
export async function listAdminProducts(opts: { q?: string; categoryId?: string; filter?: ProductFilter } = {}): Promise<AdminProductRow[]> {
  const supabase = await createServerSupabase();
  let query = supabase
    .from("products")
    .select("id, slug, name, price_cents, stock, is_active, categories(name), product_images(path, sort_order)")
    .order("name");
  const q = opts.q?.trim();
  if (q) query = query.ilike("name", `%${q.replace(/[%_\\]/g, "\\$&")}%`);
  if (opts.categoryId && UUID.test(opts.categoryId)) query = query.eq("category_id", opts.categoryId);
  if (opts.filter === "visibles") query = query.eq("is_active", true);
  if (opts.filter === "ocultos") query = query.eq("is_active", false);
  if (opts.filter === "agotados") query = query.eq("stock", 0);
  if (opts.filter === "poco-stock") query = query.eq("is_active", true).gte("stock", 1).lte("stock", 3);

  const [{ data, error }, reserved] = await Promise.all([query, reservedByProduct(supabase)]);
  if (error) throw error;
  const { url } = supabaseEnv();
  return data.map((p) => {
    const main = [...p.product_images].sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      categoryName: p.categories?.name ?? "",
      priceCents: p.price_cents,
      stock: p.stock,
      reserved: reserved.get(p.id) ?? 0,
      isActive: p.is_active,
      imageUrl: productImageUrl(main?.path ?? null, url),
    };
  });
}

export type StockReason = "alta" | "venta_web" | "devolucion_web" | "venta_manual" | "anulacion_venta_manual" | "ajuste" | "compra" | "anulacion_compra";

export type StockMovement = {
  id: number;
  delta: number;
  reason: StockReason;
  note: string | null;
  createdAt: string;
  /** Venta manual a la que corresponde (para anularla). */
  sale: { id: string; channel: "tienda" | "whatsapp"; voided: boolean } | null;
};

export type AdminProductDetail = {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  priceCents: number;
  compareAtCents: number | null;
  minAge: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  stock: number;
  reserved: number;
  description: string | null;
  isNew: boolean;
  isActive: boolean;
  images: { id: string; path: string; url: string }[];
  movements: StockMovement[];
};

/** Un producto para editarlo, con sus fotos, lo apartado y los últimos 50 movimientos de stock. */
export async function getAdminProduct(productId: string): Promise<AdminProductDetail | null> {
  if (!UUID.test(productId)) return null;
  const supabase = await createServerSupabase();
  const [{ data: p }, { data: moves }, reserved] = await Promise.all([
    supabase.from("products").select("*, product_images(id, path, sort_order)").eq("id", productId).maybeSingle(),
    supabase
      .from("stock_movements")
      .select("id, delta, reason, ref_id, note, created_at")
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50),
    reservedByProduct(supabase),
  ]);
  if (!p) return null;

  const saleIds = (moves ?? []).filter((m) => m.reason === "venta_manual" && m.ref_id).map((m) => m.ref_id as string);
  const { data: sales } = saleIds.length
    ? await supabase.from("manual_sales").select("id, channel, voided_at").in("id", saleIds)
    : { data: [] };
  const saleById = new Map((sales ?? []).map((s) => [s.id, s]));
  const { url } = supabaseEnv();

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    categoryId: p.category_id,
    priceCents: p.price_cents,
    compareAtCents: p.compare_at_cents,
    minAge: p.min_age,
    minPlayers: p.min_players,
    maxPlayers: p.max_players,
    stock: p.stock,
    reserved: reserved.get(p.id) ?? 0,
    description: p.description,
    isNew: p.is_new,
    isActive: p.is_active,
    images: [...p.product_images]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({ id: img.id, path: img.path, url: productImageUrl(img.path, url) })),
    movements: (moves ?? []).map((m) => {
      const sale = m.ref_id ? saleById.get(m.ref_id) : undefined;
      return {
        id: m.id,
        delta: m.delta,
        reason: m.reason as StockReason,
        note: m.note,
        createdAt: m.created_at,
        sale: sale ? { id: sale.id, channel: sale.channel as "tienda" | "whatsapp", voided: sale.voided_at !== null } : null,
      };
    }),
  };
}

// Ajustes ---------------------------------------------------------------------------------------------

export type SettingsData = {
  store: { storeName: string; tagline: string; whatsappPhone: string; address: string; pickupHours: string };
  fees: { homeCents: number; meetingCents: number };
  zones: { id: string; name: string; mode: "domicilio" | "punto"; sortOrder: number; isActive: boolean }[];
  points: { id: string; name: string; reference: string | null; sortOrder: number; isActive: boolean }[];
  wallets: { id: string; name: string; accountHolder: string | null; qrUrl: string; sortOrder: number; isActive: boolean }[];
  categories: { id: string; name: string; sortOrder: number; productCount: number }[];
  admins: { id: string; email: string; fullName: string | null }[];
  sampleCount: number;
  me: string;
};

/** Todo lo que se edita en Ajustes, incluso lo desactivado. */
export async function getSettingsData(): Promise<SettingsData> {
  const supabase = await createServerSupabase();
  const [claims, settings, zones, points, wallets, categories, admins, samples] = await Promise.all([
    supabase.auth.getClaims(),
    supabase.from("store_settings").select("*").maybeSingle(),
    supabase.from("delivery_zones").select("id, name, mode, sort_order, is_active").order("sort_order").order("name"),
    supabase.from("meeting_points").select("id, name, reference, sort_order, is_active").order("sort_order").order("name"),
    supabase.from("payment_methods").select("id, name, account_holder, qr_path, sort_order, is_active").order("sort_order"),
    supabase.from("categories").select("id, name, sort_order, products(count)").order("sort_order").order("name"),
    supabase.rpc("admin_list_admins"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("is_sample", true),
  ]);
  for (const r of [settings, zones, points, wallets, categories, admins]) if (r.error) throw r.error;
  const { url } = supabaseEnv();
  const s = settings.data;
  return {
    store: {
      storeName: s?.store_name ?? "",
      tagline: s?.tagline ?? "",
      whatsappPhone: s?.whatsapp_phone ?? "",
      address: s?.address ?? "",
      pickupHours: s?.pickup_hours ?? "",
    },
    fees: { homeCents: s?.delivery_fee_home_cents ?? 0, meetingCents: s?.delivery_fee_meeting_cents ?? 0 },
    zones: (zones.data ?? []).map((z) => ({ id: z.id, name: z.name, mode: z.mode, sortOrder: z.sort_order, isActive: z.is_active })),
    points: (points.data ?? []).map((p) => ({ id: p.id, name: p.name, reference: p.reference, sortOrder: p.sort_order, isActive: p.is_active })),
    wallets: (wallets.data ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      accountHolder: w.account_holder,
      qrUrl: w.qr_path.startsWith("/") ? w.qr_path : `${url}/storage/v1/object/public/store-assets/${w.qr_path}`,
      sortOrder: w.sort_order,
      isActive: w.is_active,
    })),
    categories: (categories.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      sortOrder: c.sort_order,
      productCount: (c.products as unknown as { count: number }[])[0]?.count ?? 0,
    })),
    admins: (admins.data ?? []).map((a) => ({ id: a.id, email: a.email, fullName: a.full_name })),
    sampleCount: samples.count ?? 0,
    me: claims.data?.claims?.sub ?? "",
  };
}

// Portada ---------------------------------------------------------------------------------------------

export type DashboardSummary = {
  pendingReview: number;
  pendingReviewOver24h: number;
  toDeliver: number;
  salesToday: { cents: number; count: number };
  salesMonth: { cents: number; count: number };
  shippingMonthCents: number;
  lowStock: { id: string; name: string; stock: number }[];
  outOfStock: number;
};

/** Números de la portada (reglas de "venta" en admin_dashboard_summary). */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_dashboard_summary");
  if (error) throw error;
  return data as unknown as DashboardSummary;
}

// Costo y ganancia de un producto -------------------------------------------------------------------------

export type ProductCostSummary = {
  currentUnitCostCents: number | null;
  costOrigin: "compra" | "inicial" | null;
  averageUnitCostCents: number | null;
  initialCostCents: number | null;
  lastPurchase: {
    purchaseId: string;
    supplierId: string;
    supplierName: string;
    supplierWhatsapp: string | null;
    receivedAt: string;
    quantity: number;
    unitCostCents: number;
  } | null;
  purchases: { purchaseId: string; supplierName: string; receivedAt: string | null; status: string; quantity: number; unitCostCents: number | null }[];
  sold: { units: number; unitsWithoutCost: number; revenueCents: number; profitCents: number };
};

export async function getProductCostSummary(productId: string): Promise<ProductCostSummary | null> {
  if (!UUID.test(productId)) return null;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_product_cost_summary", { p_product_id: productId });
  if (error) throw error;
  return data as unknown as ProductCostSummary;
}
