// Períodos del dashboard. Los rangos los calcula la base (dashboard_period); aquí solo se ponen en palabras.

export type Period = "hoy" | "7dias" | "mes" | "mes-anterior" | "12meses";
export type Range = { from: string; to: string };

export const PERIODS: { value: Period; label: string }[] = [
  { value: "hoy", label: "Hoy" },
  { value: "7dias", label: "7 días" },
  { value: "mes", label: "Este mes" },
  { value: "mes-anterior", label: "Mes anterior" },
  { value: "12meses", label: "12 meses" },
];

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function parsePeriod(v: string | string[] | undefined): Period {
  const one = Array.isArray(v) ? v[0] : v;
  return PERIODS.find((p) => p.value === one)?.value ?? "mes";
}

/** Fecha civil YYYY-MM-DD, sin zona horaria. */
export function civil(date: string): { y: number; m: number; d: number; weekday: number } {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

export function monthName(date: string): string {
  return MONTHS[civil(date).m - 1];
}

export function profitTitle(p: Period, range: Range): string {
  switch (p) {
    case "hoy":
      return "Ganaste hoy";
    case "7dias":
      return "Ganaste en los últimos 7 días";
    case "12meses":
      return "Ganaste en los últimos 12 meses";
    default:
      return `Ganaste en ${monthName(range.from)}`;
  }
}

export function previousLabel(p: Period, range: Range): string {
  switch (p) {
    case "hoy":
      return "ayer";
    case "7dias":
      return "los 7 días anteriores";
    case "12meses":
      return "los 12 meses anteriores";
    default:
      return MONTHS[(civil(range.from).m + 10) % 12];
  }
}

export function barLabel(kind: "dia" | "semana" | "mes", from: string, idx: number): string {
  const c = civil(from);
  if (kind === "dia") return `${DAYS[c.weekday]} ${c.d}`;
  if (kind === "semana") return `sem ${idx}`;
  return MONTHS[c.m - 1].slice(0, 3);
}
