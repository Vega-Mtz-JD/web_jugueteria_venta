import { z } from "zod";

export const DEPARTMENTS = [
  "La Paz",
  "Cochabamba",
  "Santa Cruz",
  "Oruro",
  "Potosí",
  "Chuquisaca",
  "Tarija",
  "Beni",
  "Pando",
] as const;

/** Celular boliviano: 8 dígitos que empiezan con 6 o 7; acepta +591 y espacios. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "").replace(/^591(?=\d{8}$)/, "");
  return /^[67]\d{7}$/.test(digits) ? digits : null;
}

/** CI: 5–10 dígitos, con complemento (-1A) y/o extensión (LP) opcionales. */
export function isValidCi(raw: string): boolean {
  return /^\d{5,10}(-[0-9A-Z]{1,2})?( ?[A-Z]{2,3})?$/i.test(raw.trim());
}

export function isValidNit(raw: string): boolean {
  return /^\d{5,13}$/.test(raw.trim());
}

const optionalText = z.string().trim().optional().transform((v) => (v ? v : undefined));

export const checkoutSchema = z
  .object({
    method: z.enum(["recojo", "envio_ciudad", "encomienda"], { error: "Elige cómo quieres recibir tu pedido" }),
    recipientName: z.string().trim().min(3, { error: "Escribe el nombre de quien recibe" }),
    phone: z.string().transform((v, ctx) => {
      const phone = normalizePhone(v);
      if (!phone) ctx.addIssue({ code: "custom", message: "Escribe un celular de 8 dígitos (empieza con 6 o 7)" });
      return phone ?? v;
    }),
    zoneId: optionalText,
    zoneMode: z.enum(["domicilio", "punto"]).optional(),
    address: optionalText,
    addressReference: optionalText,
    meetingPointId: optionalText,
    meetingPointCustom: optionalText,
    recipientCi: optionalText,
    department: optionalText,
    city: optionalText,
    invoiceRequested: z.boolean(),
    invoiceNit: optionalText,
    invoiceName: optionalText,
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    if (v.method === "envio_ciudad") {
      if (!v.zoneId) issue("zoneId", "Elige una zona");
      else if (v.zoneMode === "domicilio" && !v.address) issue("address", "Escribe la dirección de entrega");
      else if (v.zoneMode === "punto" && !v.meetingPointId && !v.meetingPointCustom)
        issue("meetingPointId", "Elige un punto de encuentro o escribe uno");
    }
    if (v.method === "encomienda") {
      if (!v.recipientCi) issue("recipientCi", "Escribe el CI de quien recoge");
      else if (!isValidCi(v.recipientCi)) issue("recipientCi", "Revisa el CI (por ejemplo 1234567 o 1234567-1A)");
      if (!v.department || !(DEPARTMENTS as readonly string[]).includes(v.department)) issue("department", "Elige el departamento");
      if (!v.city) issue("city", "Escribe la ciudad");
    }
    if (v.invoiceRequested) {
      if (!v.invoiceNit) issue("invoiceNit", "Escribe el NIT o CI para la factura");
      else if (!isValidNit(v.invoiceNit) && !isValidCi(v.invoiceNit)) issue("invoiceNit", "Revisa el NIT o CI");
      if (!v.invoiceName) issue("invoiceName", "Escribe la razón social");
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;
