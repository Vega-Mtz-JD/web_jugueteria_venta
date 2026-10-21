import { formatBs } from "@/lib/money";
import { bsTextToCents } from "../product-schema";

export type Currency = "BOB" | "USD";

/** "A cuánto estaba el dólar": coma o punto decimal, hasta 4 decimales, entre 0 y 100. */
export function parseRate(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,4})?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n < 100 ? n : null;
}

/** Monto con el formato boliviano en su moneda: "Bs 1.234,50" o "US$ 1.234,50". */
export function formatMoney(cents: number, currency: Currency): string {
  const bs = formatBs(cents);
  return currency === "USD" ? bs.replace(/^Bs /, "US$ ") : bs;
}

/** Texto escrito por el dueño → centavos (sirve para Bs y para dólares). */
export const moneyToCents = bsTextToCents;
