import { z } from "zod";
import { moneyToCents, parseRate } from "./money";

// Los formularios mandan texto: aquí se pasa a enteros y centavos con los mensajes que ve el dueño.
const currency = z.enum(["BOB", "USD"], { error: "Elige si la compra es en bolivianos o en dólares" });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha");
const RATE = "Anota a cuánto estaba el dólar";

const quantity = (message: string, min: number) =>
  z.string().transform((v, ctx) => {
    const n = Number(v.trim());
    if (!Number.isInteger(n) || n < min || n > 10000) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return n;
  });

const cents = (message: string, opts: { allowEmpty?: boolean; positive?: boolean } = {}) =>
  z.string().transform((v, ctx) => {
    if (opts.allowEmpty && v.trim() === "") return 0;
    const c = moneyToCents(v);
    if (c === null || (opts.positive && c <= 0) || c > 100_000_000) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return c;
  });

const line = z
  .object({
    productId: z.uuid().optional(),
    newProduct: z
      .object({
        name: z.string().trim().min(3, "Escribe el nombre del juego nuevo (3 a 120 letras)").max(120, "Escribe el nombre del juego nuevo (3 a 120 letras)"),
        categoryId: z.uuid({ error: "Elige la categoría del juego nuevo" }),
      })
      .optional(),
    quantity: quantity("La cantidad debe ser entre 1 y 10000", 1),
    unitPrice: cents("Escribe el precio de cada producto"),
  })
  .superRefine((l, ctx) => {
    if (!l.productId === !l.newProduct) ctx.addIssue({ code: "custom", message: "Elige un producto o escribe uno nuevo" });
  })
  .transform(({ unitPrice, ...l }) => ({
    ...(l.productId ? { productId: l.productId } : { newProduct: l.newProduct! }),
    quantity: l.quantity,
    unitPriceCents: unitPrice,
  }));

export const purchaseInputSchema = z.object({
  supplierId: z.uuid({ error: "Elige un proveedor" }),
  orderedOn: date,
  currency,
  note: z.string().trim().max(500),
  lines: z.array(line).min(1, "Agrega al menos un producto").max(50, "Una compra puede tener hasta 50 productos"),
});

/** "Llegó" o "Corregir llegada". */
export const arrivalInputSchema = z
  .object({
    currency,
    received: z.array(z.object({ itemId: z.uuid(), quantity: quantity("Revisa las cantidades que llegaron", 0) })),
    shipping: cents("Escribe el costo de la encomienda en Bs", { allowEmpty: true }),
    rate: z.string(),
  })
  .transform((v, ctx) => {
    const rate = v.rate.trim() ? parseRate(v.rate) : null;
    if (v.currency === "USD" && rate === null) {
      ctx.addIssue({ code: "custom", message: RATE });
      return z.NEVER;
    }
    return { received: v.received, shippingCents: v.shipping, rate: v.currency === "USD" ? rate : null };
  });

export const paymentInputSchema = z
  .object({
    purchaseCurrency: currency,
    paidOn: date,
    currency,
    amount: cents("Escribe el monto del pago", { positive: true }),
    rate: z.string(),
    note: z.string().trim().max(300),
    kind: z.enum(["pago", "devolucion"]),
  })
  .transform((v, ctx) => {
    const needsRate = v.currency === "USD" || v.purchaseCurrency === "USD";
    const rate = v.rate.trim() ? parseRate(v.rate) : null;
    if (needsRate && rate === null) {
      ctx.addIssue({ code: "custom", message: RATE });
      return z.NEVER;
    }
    return { paidOn: v.paidOn, currency: v.currency, amountCents: v.amount, rate: needsRate ? rate : null, note: v.note, kind: v.kind };
  });

export type PurchaseInput = z.input<typeof purchaseInputSchema>;
export type ArrivalInput = z.input<typeof arrivalInputSchema>;
export type PaymentInput = z.input<typeof paymentInputSchema>;
