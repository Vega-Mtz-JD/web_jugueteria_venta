"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { checkoutSchema, type CheckoutInput } from "./schema";

const itemsSchema = z
  .array(z.object({ productId: z.uuid(), quantity: z.number().int().min(1).max(20) }))
  .min(1)
  .max(30);

export type CreateOrderResult = { orderId: string } | { error: string };

export async function createOrderAction(
  input: CheckoutInput & { requestId: string; items: { productId: string; quantity: number }[] },
): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const items = itemsSchema.safeParse(input.items);
  if (!items.success) return { error: "Tu carrito está vacío" };
  const requestId = z.uuid().safeParse(input.requestId);
  if (!requestId.success) return { error: "Vuelve a cargar la página e inténtalo de nuevo" };

  const d = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("create_order", {
    p_request_id: requestId.data,
    p_items: items.data.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_delivery: {
      method: d.method,
      recipient_name: d.recipientName,
      phone: d.phone,
      zone_id: d.zoneId,
      address: d.address,
      address_reference: d.addressReference,
      meeting_point_id: d.meetingPointId,
      meeting_point_custom: d.meetingPointCustom,
      recipient_ci: d.recipientCi,
      department: d.department,
      city: d.city,
    },
    p_invoice: { requested: d.invoiceRequested, nit: d.invoiceNit, name: d.invoiceName },
  });
  if (error) {
    // P0001: mensaje pensado para el comprador (stock, producto no disponible, datos de entrega).
    return { error: error.code === "P0001" ? error.message : "No pudimos crear el pedido. Vuelve a intentarlo." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { orderId: row.order_id };
}
