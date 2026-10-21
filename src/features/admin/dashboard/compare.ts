import { formatBs } from "@/lib/money";
import type { SalesTotals } from "./queries";

export type Comparison = { tone: "up" | "down" | "same" | "neutral"; text: string };

const MISSING = " · la ganancia no se compara porque faltan costos";

/**
 * Línea de comparación con el período anterior. Si alguno de los dos tiene ventas sin costo anotado,
 * la ganancia saldría engañosa (spec §4.2): se comparan las ventas.
 */
export function compareLine(cur: SalesTotals, prev: SalesTotals, prevLabel: string): Comparison {
  if (prev.count === 0) return { tone: "neutral", text: `Sin ventas en ${prevLabel} para comparar` };
  const bySales = cur.withoutCostCents > 0 || prev.withoutCostCents > 0;
  const diff = bySales ? cur.salesCents - prev.salesCents : cur.profitCents - prev.profitCents;
  const suffix = bySales ? MISSING : "";
  if (diff === 0) return { tone: "same", text: `Igual que ${prevLabel}${suffix}` };
  const amount = formatBs(Math.abs(diff));
  const verb = bySales ? "Vendiste " : "";
  return diff > 0
    ? { tone: "up", text: `▲ ${verb}${amount} más que ${prevLabel}${suffix}` }
    : { tone: "down", text: `▼ ${verb}${amount} menos que ${prevLabel}${suffix}` };
}
