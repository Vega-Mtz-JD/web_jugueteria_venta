// Textos del Web Push y de los correos. TS puro: lo usa la Edge Function (Deno) y lo prueba Vitest.
import type { ClaimedNotification } from "./types.ts";

type Order = NonNullable<ClaimedNotification["order"]>;
export type Push = { title: string; body: string; url: string; tag: string };
export type Email = { to: string; subject: string; html: string; text: string };

/** Igual que src/lib/money.ts (la función se empaqueta sola y no puede importar de src/). */
export function formatBs(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const thousands = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const decimals = abs % 100;
  return `Bs ${sign}${thousands}${decimals === 0 ? "" : `,${String(decimals).padStart(2, "0")}`}`;
}

const code = (o: Order) => `#${String(o.number).padStart(4, "0")}`;

function delivery(o: Order): string {
  if (o.deliveryMethod === "recojo") return "Recojo en tienda";
  if (o.deliveryMethod === "encomienda") return `Encomienda a ${o.city ?? "otro departamento"}`;
  return `Envío a ${o.zoneName ?? "La Paz"}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function adminTitle(n: ClaimedNotification, o: Order): string {
  return n.kind === "nueva_captura"
    ? `Nueva captura del pedido ${code(o)} · ${formatBs(o.totalCents)}`
    : `Nuevo pedido ${code(o)} · ${formatBs(o.totalCents)} · ${delivery(o)}`;
}

export function buildPush(n: ClaimedNotification): Push {
  if (n.kind === "prueba" || !n.order) {
    return { title: "Avisos activados", body: "Así te avisaremos cuando llegue un pago", url: "/panel", tag: "prueba" };
  }
  const o = n.order;
  return {
    title: adminTitle(n, o),
    body: n.kind === "nueva_captura" ? "El comprador subió otra captura después del rechazo" : "Toca para revisar la captura",
    url: `/panel/pedidos/${o.id}`,
    tag: o.id,
  };
}

/** Asunto y párrafos (texto plano) de cada correo al comprador. */
function customerContent(n: ClaimedNotification, o: Order): { subject: string; lines: string[]; link: { href: string; label: string } } {
  const c = code(o);
  const store = n.store;
  const order = { href: `/pedidos/${o.id}`, label: "Ver mi pedido" };
  switch (n.kind) {
    case "pedido_recibido":
      return {
        subject: `Recibimos tu pedido ${c}`,
        lines: [`Total: ${formatBs(o.totalCents)} (${delivery(o)}).`, "Paga con QR y sube la captura en los próximos 60 minutos; si no, el pedido se cancela solo."],
        link: { href: `/pedidos/${o.id}/pago`, label: "Pagar ahora" },
      };
    case "pago_confirmado":
      return {
        subject: `Confirmamos tu pago del pedido ${c}`,
        lines: [
          o.deliveryMethod === "recojo"
            ? "Te avisaremos cuando esté listo para recoger."
            : o.deliveryMethod === "encomienda"
              ? "Lo enviaremos por bus y te mandaremos la agencia y el número de guía."
              : "Estamos preparando tu envío.",
        ],
        link: order,
      };
    case "pago_rechazado":
      return {
        subject: `No pudimos confirmar el pago del pedido ${c}`,
        lines: [`Motivo: ${o.rejectionReason ?? "no pudimos verificar la captura"}.`, "Puedes subir otra captura durante 48 horas."],
        link: { href: `/pedidos/${o.id}/pago`, label: "Subir otra captura" },
      };
    case "enviado":
      return {
        subject: `Tu pedido ${c} va en camino`,
        lines:
          o.deliveryMethod === "encomienda" && (o.shippingAgency || o.trackingCode)
            ? [`Agencia ${o.shippingAgency ?? "—"} · Guía ${o.trackingCode ?? "—"}`, "Recógelo con tu carnet de identidad."]
            : [`${delivery(o)}: pronto llega a tus manos.`],
        link: order,
      };
    case "listo_para_recoger":
      return {
        subject: `Tu pedido ${c} está listo para recoger`,
        lines: [store?.address ? `Dirección: ${store.address}.` : "Te esperamos en la tienda.", ...(store?.pickupHours ? [`Horario: ${store.pickupHours}.`] : [])],
        link: order,
      };
    case "cancelado":
      return {
        subject: `Tu pedido ${c} se canceló`,
        lines: [`${o.note ?? "El pedido se canceló"}.`, ...(store?.whatsappPhone ? [`Si tienes dudas, escríbenos por WhatsApp: ${store.whatsappPhone}.`] : [])],
        link: order,
      };
    case "reembolsado":
      return {
        subject: `Reembolsamos tu pedido ${c}`,
        lines: ["El dinero se devuelve por fuera de la web; si tienes dudas, escríbenos por WhatsApp" + (store?.whatsappPhone ? ` (${store.whatsappPhone}).` : ".")],
        link: order,
      };
    default:
      return { subject: `Tu pedido ${c}`, lines: [], link: order };
  }
}

function render(storeName: string, greeting: string, lines: string[], link: { href: string; label: string }) {
  const text = [greeting, "", ...lines, "", `${link.label}: ${link.href}`, "", storeName].join("\n");
  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#f6efe3;font-family:Arial,Helvetica,sans-serif;color:#2b2118">
<div style="max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:22px;font-weight:bold;margin:0 0 16px">${escapeHtml(storeName)}</p>
<div style="background:#fffaf1;border-radius:16px;padding:20px">
<p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
${lines.map((l) => `<p style="margin:0 0 12px">${escapeHtml(l)}</p>`).join("\n")}
<p style="margin:20px 0 0"><a href="${escapeHtml(link.href)}" style="display:inline-block;background:#1f4d3a;color:#f6efe3;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:10px">${escapeHtml(link.label)}</a></p>
</div></div></body></html>`;
  return { text, html };
}

export function buildEmails(n: ClaimedNotification, siteUrl: string): Email[] {
  const o = n.order;
  if (n.kind === "prueba" || !o) return [];
  const storeName = n.store?.name ?? "Ludiq";
  const site = siteUrl.replace(/\/$/, "");

  if (n.audience === "admins") {
    const push = buildPush(n);
    const { text, html } = render(storeName, push.title, [push.body], { href: `${site}${push.url}`, label: "Abrir en el panel" });
    return n.admins.map((a) => ({ to: a.email, subject: push.title, text, html }));
  }

  if (!n.customer?.email) return [];
  const content = customerContent(n, o);
  const firstName = n.customer.name.split(" ")[0] || "Hola";
  const { text, html } = render(storeName, `Hola ${firstName},`, content.lines, { href: `${site}${content.link.href}`, label: content.link.label });
  return [{ to: n.customer.email, subject: content.subject, text, html }];
}
