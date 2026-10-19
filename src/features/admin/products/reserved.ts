/** "1 apartada en pedidos", "3 apartadas en pedidos". */
export function reservedText(n: number, short = false): string {
  const word = n === 1 ? "apartada" : "apartadas";
  return short ? `${n} ${word}` : `${n} ${word} en pedidos`;
}
