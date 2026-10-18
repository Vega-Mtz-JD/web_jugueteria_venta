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
