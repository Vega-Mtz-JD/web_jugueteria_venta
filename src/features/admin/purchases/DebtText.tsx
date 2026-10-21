import { formatMoney } from "./money";
import type { Debt } from "./queries";

/** "Se le debe Bs 200 · US$ 10" o "Al día". */
export function DebtText({ debt }: { debt: Debt }) {
  const parts = [debt.BOB > 0 && formatMoney(debt.BOB, "BOB"), debt.USD > 0 && formatMoney(debt.USD, "USD")].filter(Boolean);
  if (parts.length === 0) return <span className="text-muted-foreground">Al día</span>;
  return <span className="font-semibold text-rojo">Se le debe {parts.join(" · ")}</span>;
}
