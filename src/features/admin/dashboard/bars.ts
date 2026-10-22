/** Alto de cada barra (0–100) contra el mayor valor absoluto; las negativas se dibujan hacia abajo. */
export function barScale(values: number[]): { pct: number; negative: boolean }[] {
  const max = Math.max(0, ...values.map(Math.abs));
  return values.map((v) => ({ pct: max === 0 ? 0 : Math.round((Math.abs(v) / max) * 100), negative: v < 0 }));
}

/** Monto corto, en Bs y sin decimales, para que quepa encima de una barra angosta: "346", "3,5 mil", "13 mil". */
export function barAmount(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const bs = Math.abs(cents) / 100;
  if (bs < 1000) return `${sign}${Math.round(bs)}`;
  const thousands = bs / 1000;
  const text = thousands < 10 ? thousands.toFixed(1).replace(".", ",").replace(/,0$/, "") : String(Math.round(thousands));
  return `${sign}${text} mil`;
}
