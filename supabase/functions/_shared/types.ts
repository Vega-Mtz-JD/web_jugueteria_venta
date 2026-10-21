// Lo que devuelve public.claim_notifications() por cada aviso (ver 20261021000001_avisos.sql).

export type NotificationKind =
  | "pedido_recibido"
  | "pago_por_revisar"
  | "nueva_captura"
  | "pago_confirmado"
  | "pago_rechazado"
  | "enviado"
  | "listo_para_recoger"
  | "cancelado"
  | "reembolsado"
  | "prueba";

export type ClaimedNotification = {
  id: number;
  kind: NotificationKind;
  audience: "admins" | "cliente";
  targetUserId: string | null;
  order: {
    id: string;
    number: number;
    totalCents: number;
    subtotalCents: number;
    deliveryFeeCents: number;
    deliveryMethod: "recojo" | "envio_ciudad" | "encomienda";
    zoneName: string | null;
    city: string | null;
    department: string | null;
    rejectionReason: string | null;
    shippingAgency: string | null;
    trackingCode: string | null;
    statusChangedAt: string;
    note: string | null;
  } | null;
  customer: { email: string; name: string } | null;
  admins: { userId: string; email: string }[];
  store: { name: string; address: string | null; pickupHours: string | null; whatsappPhone: string | null } | null;
};
