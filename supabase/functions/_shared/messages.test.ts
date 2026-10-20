import { describe, expect, it } from "vitest";
import { formatBs as storeFormatBs } from "../../../src/lib/money";
import { buildEmails, buildPush, formatBs } from "./messages.ts";
import type { ClaimedNotification } from "./types.ts";

const base: ClaimedNotification = {
  id: 1,
  kind: "pago_por_revisar",
  audience: "admins",
  targetUserId: null,
  order: {
    id: "11111111-1111-4111-8111-111111111111",
    number: 231,
    totalCents: 57000,
    subtotalCents: 57000,
    deliveryFeeCents: 0,
    deliveryMethod: "encomienda",
    zoneName: null,
    city: "Cochabamba",
    department: "Cochabamba",
    rejectionReason: null,
    shippingAgency: null,
    trackingCode: null,
    statusChangedAt: "2026-10-21T14:00:00Z",
    note: null,
  },
  customer: { email: "ana@test.bo", name: "Ana Mamani" },
  admins: [
    { userId: "a1", email: "dueno@test.bo" },
    { userId: "a2", email: "hijo@test.bo" },
  ],
  store: { name: "Ludiq", address: "Calle Comercio 123, La Paz", pickupHours: "Lun a Sáb, 10:00–19:00", whatsappPhone: "+59170000000" },
};
const n = (over: Partial<ClaimedNotification> = {}, order: Partial<NonNullable<ClaimedNotification["order"]>> = {}): ClaimedNotification => ({
  ...base,
  ...over,
  order: over.order === null ? null : { ...base.order!, ...order },
});

describe("formatBs", () => {
  it("es igual al de la tienda", () => {
    for (const c of [0, 50, 57000, 125050, 100000000]) expect(formatBs(c)).toBe(storeFormatBs(c));
  });
});

describe("buildPush", () => {
  it("pago por revisar: el texto exacto del spec y abre el pedido", () => {
    expect(buildPush(n())).toEqual({
      title: "Nuevo pedido #0231 · Bs 570 · Encomienda a Cochabamba",
      body: "Toca para revisar la captura",
      url: "/panel/pedidos/11111111-1111-4111-8111-111111111111",
      tag: "11111111-1111-4111-8111-111111111111",
    });
  });
  it("una segunda captura después del rechazo no dice «Nuevo pedido»", () => {
    expect(buildPush(n({ kind: "nueva_captura" })).title).toBe("Nueva captura del pedido #0231 · Bs 570");
  });
  it("recojo y envío en la ciudad", () => {
    expect(buildPush(n({}, { deliveryMethod: "recojo" })).title).toBe("Nuevo pedido #0231 · Bs 570 · Recojo en tienda");
    expect(buildPush(n({}, { deliveryMethod: "envio_ciudad", zoneName: "Sopocachi" })).title).toBe("Nuevo pedido #0231 · Bs 570 · Envío a Sopocachi");
  });
  it("aviso de prueba", () => {
    expect(buildPush(n({ kind: "prueba", order: null }))).toMatchObject({ title: "Avisos activados", url: "/panel" });
  });
});

describe("buildEmails", () => {
  const site = "https://ludiq-lapaz.netlify.app";
  it("a los admins: un correo a cada uno con el enlace al panel", () => {
    const mails = buildEmails(n(), site);
    expect(mails.map((m) => m.to)).toEqual(["dueno@test.bo", "hijo@test.bo"]);
    expect(mails[0].subject).toBe("Nuevo pedido #0231 · Bs 570 · Encomienda a Cochabamba");
    expect(mails[0].html).toContain(`${site}/panel/pedidos/11111111-1111-4111-8111-111111111111`);
  });
  it("pedido recibido: total y enlace de pago", () => {
    const [m] = buildEmails(n({ kind: "pedido_recibido", audience: "cliente" }), site);
    expect(m.to).toBe("ana@test.bo");
    expect(m.subject).toBe("Recibimos tu pedido #0231");
    expect(m.text).toContain("Bs 570");
    expect(m.text).toContain("60 minutos");
    expect(m.html).toContain(`${site}/pedidos/11111111-1111-4111-8111-111111111111/pago`);
  });
  it("pago rechazado lleva el motivo", () => {
    const [m] = buildEmails(n({ kind: "pago_rechazado", audience: "cliente" }, { rejectionReason: "Monto incorrecto" }), site);
    expect(m.subject).toBe("No pudimos confirmar el pago del pedido #0231");
    expect(m.text).toContain("Motivo: Monto incorrecto");
    expect(m.text).toContain("48 horas");
  });
  it("el texto que escribió alguien va escapado en el HTML", () => {
    const [m] = buildEmails(n({ kind: "pago_rechazado", audience: "cliente" }, { rejectionReason: "<script>alert(1)</script>" }), site);
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
  it("asuntos del resto de los pasos", () => {
    const subject = (kind: ClaimedNotification["kind"], order = {}) => buildEmails(n({ kind, audience: "cliente" }, order), site)[0].subject;
    expect(subject("pago_confirmado")).toBe("Confirmamos tu pago del pedido #0231");
    expect(subject("enviado")).toBe("Tu pedido #0231 va en camino");
    expect(subject("listo_para_recoger")).toBe("Tu pedido #0231 está listo para recoger");
    expect(subject("cancelado")).toBe("Tu pedido #0231 se canceló");
    expect(subject("reembolsado")).toBe("Reembolsamos tu pedido #0231");
  });
  it("enviado por encomienda dice agencia y guía; listo para recoger, dirección y horario", () => {
    expect(buildEmails(n({ kind: "enviado", audience: "cliente" }, { shippingAgency: "Trans Copacabana", trackingCode: "G-555" }), site)[0].text).toContain(
      "Agencia Trans Copacabana · Guía G-555",
    );
    const listo = buildEmails(n({ kind: "listo_para_recoger", audience: "cliente" }), site)[0].text;
    expect(listo).toContain("Calle Comercio 123, La Paz");
    expect(listo).toContain("Lun a Sáb, 10:00–19:00");
  });
  it("cancelado lleva la nota del evento", () => {
    expect(buildEmails(n({ kind: "cancelado", audience: "cliente" }, { note: "Venció sin pago" }), site)[0].text).toContain("Venció sin pago");
  });
  it("la prueba no manda correos", () => {
    expect(buildEmails(n({ kind: "prueba", order: null }), site)).toEqual([]);
  });
});
