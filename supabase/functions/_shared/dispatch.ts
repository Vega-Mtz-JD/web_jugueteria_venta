// Envía un aviso tomado de la cola. Las dependencias se inyectan para probarlo sin red.
import { buildEmails, buildPush, type Email, type Push } from "./messages.ts";
import type { ClaimedNotification } from "./types.ts";

export type Subscription = { id: string; userId: string; endpoint: string; p256dh: string; auth: string };

export type DispatchDeps = {
  siteUrl: string;
  sendMail(mail: Email): Promise<void>;
  /** `gone`: el servicio de push dice que esa suscripción ya no existe (404/410). */
  sendPush(sub: Subscription, payload: Push): Promise<{ gone: boolean }>;
  subscriptionsFor(userIds: string[]): Promise<Subscription[]>;
  deleteSubscription(id: string): Promise<void>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Manda los push y correos del aviso. Devuelve el primer error y cuántos envíos salieron:
 * quien llama reintenta solo si no salió ninguno (si no, repetiría lo que ya llegó).
 */
export async function dispatch(n: ClaimedNotification, deps: DispatchDeps): Promise<{ error: string | null; delivered: number }> {
  const errors: string[] = [];
  let delivered = 0;

  if (n.audience === "admins") {
    const userIds = n.kind === "prueba" ? (n.targetUserId ? [n.targetUserId] : []) : n.admins.map((a) => a.userId);
    const subs = userIds.length ? await deps.subscriptionsFor(userIds) : [];
    const payload = buildPush(n);
    await Promise.all(
      subs.map(async (s) => {
        try {
          const { gone } = await deps.sendPush(s, payload);
          if (gone) await deps.deleteSubscription(s.id);
          else delivered++;
        } catch (e) {
          errors.push(`push: ${message(e)}`);
        }
      }),
    );
  }

  for (const mail of buildEmails(n, deps.siteUrl)) {
    try {
      await deps.sendMail(mail);
      delivered++;
    } catch (e) {
      errors.push(`correo a ${mail.to}: ${message(e)}`);
    }
  }

  return { error: errors[0] ?? null, delivered };
}
