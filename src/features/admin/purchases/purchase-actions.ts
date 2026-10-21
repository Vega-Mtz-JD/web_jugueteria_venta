"use server";

import { z } from "zod";
import { invalidateCatalog } from "@/features/catalog/invalidate";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorMessage } from "../errors";
import { isAdminSession } from "../guard";
import { parseRate } from "./money";
import { arrivalInputSchema, paymentInputSchema, purchaseInputSchema, type ArrivalInput, type PaymentInput, type PurchaseInput } from "./purchase-schema";

type Result<T = object> = ({ ok: true } & T) | { error: string };
const NOT_ADMIN = { error: "Solo un administrador puede hacer esto" } as const;
const SAVE_ERROR = "No pudimos guardar. Vuelve a intentarlo.";
const uuid = z.uuid();
const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Revisa los datos";
/** Los tipos generados no admiten null en parámetros de RPC, pero la base sí (dólar o nota vacíos). */
const sqlNull = <T,>(v: T | null | undefined): T => (v ?? null) as T;

function rpcLines(lines: z.output<typeof purchaseInputSchema>["lines"]) {
  return lines.map((l) =>
    "productId" in l
      ? { product_id: l.productId, quantity: l.quantity, unit_price_cents: l.unitPriceCents }
      : { new_product: { name: l.newProduct.name, category_id: l.newProduct.categoryId }, quantity: l.quantity, unit_price_cents: l.unitPriceCents },
  );
}

async function recordPayment(requestId: string, purchaseId: string, input: PaymentInput): Promise<Result<{ id: string }>> {
  const parsed = paymentInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_record_payment", {
    p_request_id: requestId,
    p_purchase_id: purchaseId,
    p_paid_on: v.paidOn,
    p_currency: v.currency,
    p_amount_cents: v.amountCents,
    p_rate: sqlNull(v.rate),
    p_note: sqlNull(v.note || null),
    p_kind: v.kind,
  });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  return { ok: true, id: data };
}

/** Nueva compra (y el adelanto, si lo hay). Los request_id vienen del cliente: un reintento no duplica. */
export async function createPurchaseAction(
  requestId: string,
  input: PurchaseInput,
  advance: { requestId: string; payment: PaymentInput } | null,
): Promise<Result<{ id: string; warning?: string }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(requestId).success) return { error: SAVE_ERROR };
  const parsed = purchaseInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data: id, error } = await supabase.rpc("admin_create_purchase", {
    p_request_id: requestId,
    p_supplier_id: v.supplierId,
    p_ordered_on: v.orderedOn,
    p_currency: v.currency,
    p_note: sqlNull(v.note || null),
    p_lines: rpcLines(v.lines),
  });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  if (advance) {
    const paid = await recordPayment(advance.requestId, id, advance.payment);
    if ("error" in paid) return { ok: true, id, warning: `La compra se guardó, pero el adelanto no: ${paid.error}` };
  }
  return { ok: true, id };
}

export async function updatePurchaseAction(purchaseId: string, input: PurchaseInput): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = purchaseInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_update_purchase", {
    p_purchase_id: purchaseId,
    p_supplier_id: v.supplierId,
    p_ordered_on: v.orderedOn,
    p_currency: v.currency,
    p_note: sqlNull(v.note || null),
    p_lines: rpcLines(v.lines),
  });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  return { ok: true };
}

export async function receivePurchaseAction(
  purchaseId: string,
  input: ArrivalInput,
  payment: { requestId: string; payment: PaymentInput } | null,
): Promise<Result<{ warning?: string }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = arrivalInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_receive_purchase", {
    p_purchase_id: purchaseId,
    p_received: v.received.map((r) => ({ item_id: r.itemId, quantity: r.quantity })),
    p_shipping_cents: v.shippingCents,
    p_arrival_rate: sqlNull(v.rate),
  });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  invalidateCatalog();
  if (payment) {
    const paid = await recordPayment(payment.requestId, purchaseId, payment.payment);
    if ("error" in paid) return { ok: true, warning: `La llegada se guardó, pero el pago no: ${paid.error}` };
  }
  return { ok: true };
}

export async function correctArrivalAction(purchaseId: string, input: ArrivalInput): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = arrivalInputSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_correct_arrival", {
    p_purchase_id: purchaseId,
    p_received: v.received.map((r) => ({ item_id: r.itemId, quantity: r.quantity })),
    p_shipping_cents: v.shippingCents,
    p_arrival_rate: sqlNull(v.rate),
  });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  invalidateCatalog();
  return { ok: true };
}

export async function recordPaymentAction(requestId: string, purchaseId: string, input: PaymentInput): Promise<Result<{ id: string }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(requestId).success || !uuid.safeParse(purchaseId).success) return { error: SAVE_ERROR };
  return recordPayment(requestId, purchaseId, input);
}

export async function voidPaymentAction(paymentId: string): Promise<Result> {
  if (!uuid.safeParse(paymentId).success) return { error: SAVE_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_void_payment", { p_payment_id: paymentId });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  return { ok: true };
}

export async function applyCreditAction(requestId: string, fromId: string, toId: string, rateText: string): Promise<Result> {
  if (!uuid.safeParse(requestId).success || !uuid.safeParse(fromId).success || !uuid.safeParse(toId).success) return { error: "Elige la compra destino" };
  const rate = rateText.trim() ? parseRate(rateText) : null;
  if (rateText.trim() && rate === null) return { error: "Anota a cuánto estaba el dólar" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_apply_credit", { p_request_id: requestId, p_from_purchase_id: fromId, p_to_purchase_id: toId, p_rate: sqlNull(rate) });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  return { ok: true };
}

export async function voidPurchaseAction(purchaseId: string): Promise<Result> {
  if (!uuid.safeParse(purchaseId).success) return { error: SAVE_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_void_purchase", { p_purchase_id: purchaseId });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  invalidateCatalog();
  return { ok: true };
}

export async function savePurchaseNotesAction(purchaseId: string, note: string, issuesNote: string): Promise<Result> {
  if (!uuid.safeParse(purchaseId).success) return { error: SAVE_ERROR };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_set_purchase_notes", {
    p_purchase_id: purchaseId,
    p_note: sqlNull(note.slice(0, 500) || null),
    p_issues_note: sqlNull(issuesNote.slice(0, 1000) || null),
  });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  return { ok: true };
}
