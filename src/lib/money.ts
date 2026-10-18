// Los precios se guardan como enteros en centavos para evitar errores de redondeo.
// Formato boliviano: miles con punto, decimales con coma (solo si no son cero).

export function formatBs(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100);
  const decimals = abs % 100;
  const thousands = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const fraction = decimals === 0 ? "" : `,${String(decimals).padStart(2, "0")}`;
  return `Bs ${sign}${thousands}${fraction}`;
}

export function bsToCents(bs: number): number {
  return Math.round(bs * 100);
}
