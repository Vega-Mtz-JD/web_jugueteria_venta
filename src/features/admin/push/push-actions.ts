"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorMessage } from "../errors";
import { isAdminSession } from "../guard";

type Result = { ok: true } | { error: string };
const NOT_ADMIN = { error: "Solo un administrador puede hacer esto" } as const;

const subscriptionInput = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
  userAgent: z.string().max(300).optional(),
});

/** Guarda (o actualiza) la suscripción Web Push de este dispositivo para el admin con sesión. */
export async function saveSubscriptionAction(input: z.input<typeof subscriptionInput>): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = subscriptionInput.safeParse(input);
  if (!parsed.success) return { error: "No pudimos activar los avisos en este dispositivo" };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return NOT_ADMIN;
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: userId, endpoint: v.endpoint, p256dh: v.p256dh, auth: v.auth, user_agent: v.userAgent ?? null }, { onConflict: "endpoint" });
  if (error) return { error: "No pudimos activar los avisos en este dispositivo. Vuelve a intentarlo." };
  return { ok: true };
}

export async function removeSubscriptionAction(endpoint: string): Promise<Result> {
  if (!z.url().safeParse(endpoint).success) return { error: "No encontramos este dispositivo" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { error: "No pudimos desactivar los avisos. Vuelve a intentarlo." };
  return { ok: true };
}

export async function sendTestPushAction(): Promise<Result> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_send_test_push");
  if (error) return { error: adminErrorMessage(error, "No pudimos enviar el aviso de prueba. Vuelve a intentarlo.") };
  return { ok: true };
}
