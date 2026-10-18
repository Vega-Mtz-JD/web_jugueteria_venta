export type DeliveryMethod = "recojo" | "envio_ciudad" | "encomienda";
export type ZoneMode = "domicilio" | "punto";

/** Solo para mostrar: el costo real lo calcula la base al crear el pedido. */
export function estimateDeliveryFee(
  method: DeliveryMethod,
  zoneMode: ZoneMode | null,
  fees: { homeCents: number; meetingCents: number },
): number {
  if (method !== "envio_ciudad" || zoneMode === null) return 0;
  return zoneMode === "domicilio" ? fees.homeCents : fees.meetingCents;
}
