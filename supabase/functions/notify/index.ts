// Edge Function "notify": envía los avisos pendientes de public.notification_outbox.
// La despierta la base (pg_net) al encolar un aviso y un pg_cron cada 5 minutos.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import nodemailer from "npm:nodemailer@6.9.16";
import webpush from "npm:web-push@3.6.7";
import { dispatch, type Subscription } from "../_shared/dispatch.ts";
import type { ClaimedNotification } from "../_shared/types.ts";

const env = (name: string) => Deno.env.get(name) ?? "";

const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

const mailer = nodemailer.createTransport({
  host: env("SMTP_HOST"),
  port: Number(env("SMTP_PORT") || 465),
  secure: env("SMTP_SECURE") !== "false",
  auth: env("SMTP_USER") ? { user: env("SMTP_USER"), pass: env("SMTP_PASS") } : undefined,
});

webpush.setVapidDetails(`mailto:${env("MAIL_FROM").match(/<(.+)>/)?.[1] ?? env("MAIL_FROM")}`, env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));

const deps = {
  siteUrl: env("SITE_URL"),
  async sendMail(m: { to: string; subject: string; html: string; text: string }) {
    await mailer.sendMail({ from: env("MAIL_FROM"), to: m.to, subject: m.subject, html: m.html, text: m.text });
  },
  async sendPush(s: Subscription, payload: unknown) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24 });
      return { gone: false };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return { gone: true };
      throw e;
    }
  },
  async subscriptionsFor(userIds: string[]): Promise<Subscription[]> {
    const { data, error } = await supabase.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth").in("user_id", userIds);
    if (error) throw error;
    return data.map((r) => ({ id: r.id, userId: r.user_id, endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth }));
  },
  async deleteSubscription(id: string) {
    await supabase.from("push_subscriptions").delete().eq("id", id);
  },
};

Deno.serve(async (req) => {
  if (req.headers.get("Authorization") !== `Bearer ${env("NOTIFY_SECRET")}` || !env("NOTIFY_SECRET")) {
    return new Response("No autorizado", { status: 401 });
  }
  let sent = 0;
  let failed = 0;
  for (let round = 0; round < 10; round++) {
    const { data, error } = await supabase.rpc("claim_notifications", { p_limit: 20 });
    if (error) return new Response(error.message, { status: 500 });
    const batch = data as ClaimedNotification[];
    if (batch.length === 0) break;
    for (const n of batch) {
      const result = await dispatch(n, deps);
      // Si algo salió, no se reintenta (se repetiría lo entregado); el error queda en el log.
      const retry = result.error !== null && result.delivered === 0;
      if (result.error) console.error(`aviso ${n.id} (${n.kind}): ${result.error}`);
      await supabase.rpc("finish_notification", { p_id: n.id, p_error: retry ? result.error : null });
      if (retry) failed++;
      else sent++;
    }
  }
  return Response.json({ sent, failed });
});
