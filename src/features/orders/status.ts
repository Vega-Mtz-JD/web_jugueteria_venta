import type { Database } from "@/lib/supabase/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  esperando_pago: "Esperando tu pago",
  en_revision: "En revisión",
  pagado: "Pagado",
  enviado: "Enviado",
  listo_para_recoger: "Listo para recoger",
  entregado: "Entregado",
  rechazado: "Rechazado",
  cancelado: "Cancelado",
  reembolsado: "Reembolsado",
};

export function formatOrderCode(n: number): string {
  return `#${String(n).padStart(4, "0")}`;
}

export function customerCanCancel(status: OrderStatus): boolean {
  return status === "esperando_pago" || status === "rechazado";
}

export function customerCanUploadProof(status: OrderStatus): boolean {
  return status === "esperando_pago" || status === "rechazado";
}

/** Qué significa cada estado para el comprador (una línea). */
export const STATUS_HINT: Record<OrderStatus, string> = {
  esperando_pago: "Paga con QR y sube la captura para enviarnos tu pedido. Si no lo haces en 60 minutos, se cancela solo.",
  en_revision: "Estamos revisando tu pago. Te avisaremos cuando lo confirmemos.",
  pagado: "Confirmamos tu pago. Estamos preparando tu pedido.",
  enviado: "Tu pedido va en camino.",
  listo_para_recoger: "Tu pedido te espera en la tienda.",
  entregado: "Pedido entregado. ¡Que lo disfrutes!",
  rechazado: "No pudimos confirmar tu pago. Revisa el motivo y sube otra captura.",
  cancelado: "Este pedido se canceló.",
  reembolsado: "Cancelamos este pedido y te devolvimos el dinero.",
};

export const STATUS_TONE: Record<OrderStatus, "neutral" | "waiting" | "good" | "bad"> = {
  esperando_pago: "waiting",
  en_revision: "waiting",
  pagado: "good",
  enviado: "good",
  listo_para_recoger: "good",
  entregado: "good",
  rechazado: "bad",
  cancelado: "neutral",
  reembolsado: "neutral",
};
