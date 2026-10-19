"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { error: string };

export async function submitProofAction(orderId: string, path: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(orderId).success) return { error: "No encontramos ese pedido" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("submit_payment_proof", { p_order_id: orderId, p_path: path });
  if (error) return { error: error.code === "P0001" ? error.message : "No pudimos enviar la captura. Vuelve a intentarlo." };
  return { ok: true };
}

/** Estado actual del pedido propio (para explicar por qué no se pudo subir la captura). */
export async function orderStatusAction(orderId: string): Promise<string | null> {
  if (!z.uuid().safeParse(orderId).success) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("orders").select("status").eq("id", orderId).maybeSingle();
  return data?.status ?? null;
}

export async function cancelOrderAction(orderId: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(orderId).success) return { error: "No encontramos ese pedido" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("cancel_order_by_customer", { p_order_id: orderId });
  if (error) return { error: error.code === "P0001" ? error.message : "No pudimos cancelar el pedido. Vuelve a intentarlo." };
  return { ok: true };
}
