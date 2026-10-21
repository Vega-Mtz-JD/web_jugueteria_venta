/** Mensaje de "Pedir de nuevo por WhatsApp" al último proveedor (cantidad: la de la última compra). */
export function reorderMessage(input: { supplierContact: string | null; supplierName: string; productName: string; quantity: number }): string {
  const who = input.supplierContact?.trim() || input.supplierName;
  return `Hola ${who}, ¿me puedes enviar de nuevo ${input.quantity} × ${input.productName}? Gracias.`;
}
