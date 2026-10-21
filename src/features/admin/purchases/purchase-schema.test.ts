import { describe, expect, it } from "vitest";
import { arrivalInputSchema, paymentInputSchema, purchaseInputSchema } from "./purchase-schema";

const uuid = "00000000-0000-4000-8000-000000000001";
const cat = "00000000-0000-4000-8000-000000000002";
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? [] : r.error!.issues.map((i) => i.message));

describe("purchaseInputSchema", () => {
  const base = { supplierId: uuid, orderedOn: "2026-10-22", currency: "BOB", note: "", lines: [{ productId: uuid, quantity: "2", unitPrice: "100" }] };
  it("pasa a centavos y enteros", () => {
    expect(purchaseInputSchema.parse(base).lines).toEqual([{ productId: uuid, quantity: 2, unitPriceCents: 10000 }]);
  });
  it("acepta un juego nuevo", () => {
    const r = purchaseInputSchema.parse({ ...base, lines: [{ newProduct: { name: "Juego encargado", categoryId: cat }, quantity: "3", unitPrice: "100" }] });
    expect(r.lines[0]).toEqual({ newProduct: { name: "Juego encargado", categoryId: cat }, quantity: 3, unitPriceCents: 10000 });
  });
  it("cada línea necesita un producto", () => {
    expect(messages(purchaseInputSchema.safeParse({ ...base, lines: [{ quantity: "1", unitPrice: "10" }] }))).toContain("Elige un producto o escribe uno nuevo");
  });
  it("valida proveedor, moneda, cantidades y que haya líneas", () => {
    expect(messages(purchaseInputSchema.safeParse({ ...base, supplierId: "" }))).toContain("Elige un proveedor");
    expect(messages(purchaseInputSchema.safeParse({ ...base, currency: "EUR" }))).toContain("Elige si la compra es en bolivianos o en dólares");
    expect(messages(purchaseInputSchema.safeParse({ ...base, lines: [{ productId: uuid, quantity: "0", unitPrice: "1" }] }))).toContain("La cantidad debe ser entre 1 y 10000");
    expect(messages(purchaseInputSchema.safeParse({ ...base, lines: [] }))).toContain("Agrega al menos un producto");
  });
});

describe("arrivalInputSchema", () => {
  const base = { currency: "BOB", received: [{ itemId: uuid, quantity: "3" }], shipping: "30", rate: "" };
  it("convierte cantidades, envío y dólar", () => {
    expect(arrivalInputSchema.parse(base)).toEqual({ received: [{ itemId: uuid, quantity: 3 }], shippingCents: 3000, rate: null });
    expect(arrivalInputSchema.parse({ ...base, currency: "USD", rate: "6,96" }).rate).toBe(6.96);
  });
  it("una compra en dólares pide el dólar", () => {
    expect(messages(arrivalInputSchema.safeParse({ ...base, currency: "USD" }))).toContain("Anota a cuánto estaba el dólar");
  });
  it("el envío vacío es 0", () => {
    expect(arrivalInputSchema.parse({ ...base, shipping: "" }).shippingCents).toBe(0);
  });
});

describe("paymentInputSchema", () => {
  const base = { purchaseCurrency: "BOB", paidOn: "2026-10-22", currency: "BOB", amount: "100", rate: "", note: "", kind: "pago" };
  it("pago en Bs sin dólar", () => {
    expect(paymentInputSchema.parse(base)).toEqual({ paidOn: "2026-10-22", currency: "BOB", amountCents: 10000, rate: null, note: "", kind: "pago" });
  });
  it("pide el dólar si el pago o la compra es en dólares", () => {
    expect(messages(paymentInputSchema.safeParse({ ...base, currency: "USD" }))).toContain("Anota a cuánto estaba el dólar");
    expect(messages(paymentInputSchema.safeParse({ ...base, purchaseCurrency: "USD" }))).toContain("Anota a cuánto estaba el dólar");
    expect(paymentInputSchema.parse({ ...base, purchaseCurrency: "USD", rate: "7,10" }).rate).toBe(7.1);
  });
  it("el monto debe ser mayor que 0", () => {
    expect(messages(paymentInputSchema.safeParse({ ...base, amount: "0" }))).toContain("Escribe el monto del pago");
  });
});

describe("correcciones de la revisión", () => {
  it("un precio vacío no se guarda como 0", () => {
    const r = purchaseInputSchema.safeParse({ supplierId: uuid, orderedOn: "2026-10-22", currency: "BOB", note: "", lines: [{ productId: uuid, quantity: "1", unitPrice: "" }] });
    expect(messages(r)).toContain("Escribe el precio de cada producto");
  });
  it("un precio 0 escrito a propósito sí vale (regalo del proveedor)", () => {
    const r = purchaseInputSchema.parse({ supplierId: uuid, orderedOn: "2026-10-22", currency: "BOB", note: "", lines: [{ productId: uuid, quantity: "1", unitPrice: "0" }] });
    expect(r.lines[0].unitPriceCents).toBe(0);
  });
});
