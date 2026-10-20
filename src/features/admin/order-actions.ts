"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { CATALOG_TAG } from "@/features/catalog/cached";
import { Constants } from "@/lib/supabase/database.types";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorMessage } from "./errors";

export type ActionResult = { ok: true } | { error: string };

const status = z.enum(Constants.public.Enums.order_status);
const optionalText = z.string().trim().max(200).optional();

const setOrderStatusInput = z.object({
  orderId: z.uuid(),
  expectedFrom: status,
  to: status,
  rejectionReason: optionalText,
  shippingAgency: optionalText,
  trackingCode: optionalText,
  shippingProofPath: z.string().max(300).optional(),
});

export async function setOrderStatusAction(input: z.input<typeof setOrderStatusInput>): Promise<ActionResult> {
  const parsed = setOrderStatusInput.safeParse(input);
  if (!parsed.success) return { error: "Revisa los datos e inténtalo de nuevo" };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_set_order_status", {
    p_order_id: v.orderId,
    p_expected_from: v.expectedFrom,
    p_to: v.to,
    p_rejection_reason: v.rejectionReason,
    p_shipping_agency: v.shippingAgency,
    p_tracking_code: v.trackingCode,
    p_shipping_proof_path: v.shippingProofPath,
  });
  if (error) return { error: adminErrorMessage(error, "No pudimos cambiar el pedido. Vuelve a intentarlo.") };
  // Reembolsar o cancelar devuelve stock: la tienda debe mostrarlo al instante.
  if (v.to === "reembolsado" || v.to === "cancelado") updateTag(CATALOG_TAG);
  return { ok: true };
}
