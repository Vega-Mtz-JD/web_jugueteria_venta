import { civil, parsePeriod, PERIODS, type Period } from "./period";

export type Channel = "web" | "tienda" | "whatsapp";
export type SalesFilter = { period: Period | null; from: string | null; to: string | null; channel: Channel | null; withoutCost: boolean };

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: "web", label: "Web" },
  { value: "tienda", label: "Tienda" },
  { value: "whatsapp", label: "WhatsApp" },
];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function validDate(v: string | undefined): string | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const { y, m, d } = civil(v);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? v : null;
}

/** Filtro de la página Ventas desde la dirección. Fechas inválidas o al revés: Este mes. */
export function parseSalesFilter(sp: Params): SalesFilter {
  const channel = CHANNELS.find((c) => c.value === one(sp.canal))?.value ?? null;
  const withoutCost = one(sp.sincosto) === "1";
  const from = validDate(one(sp.desde));
  const to = validDate(one(sp.hasta));
  if (from && to && from <= to) return { period: null, from, to, channel, withoutCost };
  const period = PERIODS.some((p) => p.value === one(sp.periodo)) ? parsePeriod(sp.periodo) : "mes";
  return { period, from: null, to: null, channel, withoutCost };
}

export function salesHref(f: Partial<SalesFilter>): string {
  const params = new URLSearchParams();
  if (f.from && f.to) {
    params.set("desde", f.from);
    params.set("hasta", f.to);
  } else if (f.period) {
    params.set("periodo", f.period);
  }
  if (f.channel) params.set("canal", f.channel);
  if (f.withoutCost) params.set("sincosto", "1");
  const qs = params.toString();
  return qs ? `/panel/ventas?${qs}` : "/panel/ventas";
}
