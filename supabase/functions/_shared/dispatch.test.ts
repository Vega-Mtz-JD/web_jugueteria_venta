import { describe, expect, it, vi } from "vitest";
import { dispatch, type DispatchDeps, type Subscription } from "./dispatch.ts";
import type { ClaimedNotification } from "./types.ts";

const order = {
  id: "11111111-1111-4111-8111-111111111111",
  number: 231,
  totalCents: 57000,
  subtotalCents: 57000,
  deliveryFeeCents: 0,
  deliveryMethod: "recojo" as const,
  zoneName: null,
  city: null,
  department: null,
  rejectionReason: null,
  shippingAgency: null,
  trackingCode: null,
  statusChangedAt: "2026-10-21T14:00:00Z",
  note: null,
};
const notif = (over: Partial<ClaimedNotification> = {}): ClaimedNotification => ({
  id: 7,
  kind: "pago_por_revisar",
  audience: "admins",
  targetUserId: null,
  order,
  customer: { email: "ana@test.bo", name: "Ana" },
  admins: [
    { userId: "a1", email: "dueno@test.bo" },
    { userId: "a2", email: "hijo@test.bo" },
  ],
  store: { name: "Ludiq", address: null, pickupHours: null, whatsappPhone: null },
  ...over,
});
const sub = (id: string, userId: string): Subscription => ({ id, userId, endpoint: `https://push.example/${id}`, p256dh: "k", auth: "a" });

function deps(over: Partial<DispatchDeps> = {}): DispatchDeps {
  return {
    siteUrl: "https://ludiq.bo",
    sendMail: vi.fn(async () => {}),
    sendPush: vi.fn(async () => ({ gone: false })),
    subscriptionsFor: vi.fn(async (ids: string[]) => [sub("s1", "a1"), sub("s2", "a2")].filter((s) => ids.includes(s.userId))),
    deleteSubscription: vi.fn(async () => {}),
    ...over,
  };
}

describe("dispatch", () => {
  it("un celular que ya no existe se borra y los demás reciben igual", async () => {
    const d = deps({ sendPush: vi.fn(async (s: Subscription) => ({ gone: s.id === "s1" })) });
    expect(await dispatch(notif(), d)).toEqual({ error: null, delivered: 3 });
    expect(d.deleteSubscription).toHaveBeenCalledWith("s1");
    expect(d.sendPush).toHaveBeenCalledTimes(2);
    expect(d.sendMail).toHaveBeenCalledTimes(2);
  });

  it("si el correo falla, devuelve el error para reintentar", async () => {
    const d = deps({ sendMail: vi.fn(async () => { throw new Error("535 5.7.8 Username and Password not accepted"); }) });
    const { error } = await dispatch(notif(), d);
    expect(error).toContain("535");
  });

  it("un aviso al comprador no busca celulares", async () => {
    const d = deps();
    await dispatch(notif({ kind: "pago_confirmado", audience: "cliente" }), d);
    expect(d.subscriptionsFor).not.toHaveBeenCalled();
    expect(d.sendMail).toHaveBeenCalledTimes(1);
  });

  it("el aviso de prueba va solo al admin que lo pidió", async () => {
    const d = deps();
    await dispatch(notif({ kind: "prueba", order: null, targetUserId: "a2" }), d);
    expect(d.subscriptionsFor).toHaveBeenCalledWith(["a2"]);
    expect(d.sendPush).toHaveBeenCalledTimes(1);
    expect(d.sendMail).not.toHaveBeenCalled();
  });

  it("un push que falla (no «gone») cuenta como error", async () => {
    const d = deps({ sendPush: vi.fn(async () => { throw new Error("503 servicio push"); }) });
    expect((await dispatch(notif(), d)).error).toContain("503");
  });

  it("si una parte salió, lo dice: reintentar mandaría de nuevo lo que ya llegó", async () => {
    const d = deps({ sendMail: vi.fn(async (m: { to: string }) => { if (m.to === "hijo@test.bo") throw new Error("550 buzón lleno"); }) });
    const r = await dispatch(notif(), d);
    expect(r.error).toContain("550");
    expect(r.delivered).toBe(3); // 2 push + 1 correo
  });
});
