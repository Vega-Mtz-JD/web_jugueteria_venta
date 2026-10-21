/** Alto de cada barra (0–100) contra el mayor valor absoluto; las negativas se dibujan hacia abajo. */
export function barScale(values: number[]): { pct: number; negative: boolean }[] {
  const max = Math.max(0, ...values.map(Math.abs));
  return values.map((v) => ({ pct: max === 0 ? 0 : Math.round((Math.abs(v) / max) * 100), negative: v < 0 }));
}
