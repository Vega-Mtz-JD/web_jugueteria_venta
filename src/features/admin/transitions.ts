import type { Database } from "@/lib/supabase/database.types";
import type { OrderStatus } from "@/features/orders/status";

export type DeliveryMethod = Database["public"]["Enums"]["delivery_method"];
export type Action = "confirmar" | "rechazar" | "listo" | "enviar" | "entregar" | "reembolsar" | "cancelar";

/** Estado al que lleva cada botón (la base valida lo mismo en admin_set_order_status). */
export const ACTION_TARGET: Record<Action, OrderStatus> = {
  confirmar: "pagado",
  rechazar: "rechazado",
  listo: "listo_para_recoger",
  enviar: "enviado",
  entregar: "entregado",
  reembolsar: "reembolsado",
  cancelar: "cancelado",
};

/** Botones que el panel muestra para un pedido según su estado y su entrega. */
export function availableActions(status: OrderStatus, method: DeliveryMethod): Action[] {
  switch (status) {
    case "en_revision":
      return ["confirmar", "rechazar"];
    case "pagado":
      return [method === "recojo" ? "listo" : "enviar", "reembolsar"];
    case "enviado":
    case "listo_para_recoger":
      return ["entregar", "reembolsar"];
    case "esperando_pago":
    case "rechazado":
      return ["cancelar"];
    default:
      return [];
  }
}
