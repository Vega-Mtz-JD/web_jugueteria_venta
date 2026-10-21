import { z } from "zod";
import { bsToCents } from "@/lib/money";

// Los campos llegan como texto del formulario: vacío = sin dato.
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

/** "1.250,50", "1250,5", "1250.50" o "1.250" → número de Bs. */
function parseBs(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  // Coma decimal (con o sin puntos de miles antes): "1.250,50". Nada después de la coma salvo 1–2 dígitos.
  if (t.includes(",")) return /^\d{1,3}(\.\d{3})*,\d{1,2}$|^\d+,\d{1,2}$/.test(t) ? Number(t.replace(/\./g, "").replace(",", ".")) : NaN;
  if (/^\d{1,3}(\.\d{3})+$/.test(t)) return Number(t.replace(/\./g, ""));
  // Punto decimal con a lo más 2 decimales ("1250.5"); "1,250.50" o "6.965" se rechazan: son ambiguos.
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN;
}
/** Texto en Bs → centavos, o null si no es un monto válido (≥ 0). */
export function bsTextToCents(text: string): number | null {
  const n = parseBs(text);
  return typeof n === "number" && Number.isFinite(n) && n >= 0 ? bsToCents(n) : null;
}

/** Centavos → texto para un campo ("120", "120,50"). */
export function centsToBsText(cents: number | null): string {
  if (cents === null) return "";
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace(".", ",");
}

const toNumber = (v: unknown) => (typeof v === "string" ? Number(v.trim()) : v);

const money = (message: string) => z.number({ error: message }).positive(message).max(1_000_000, message);
const int = (min: number, max: number, message: string) => z.number({ error: message }).int(message).min(min, message).max(max, message);
const required = <T extends z.ZodType>(parse: (v: unknown) => unknown, schema: T) => z.preprocess((v) => parse(blank(v)), schema);
const optional = <T extends z.ZodType>(parse: (v: unknown) => unknown, schema: T) =>
  z.preprocess((v) => {
    const b = blank(v);
    return b === undefined ? undefined : parse(b);
  }, schema.optional());

export const productInputSchema = z
  .object({
    name: z.string().trim().min(3, "El nombre debe tener entre 3 y 120 letras").max(120, "El nombre debe tener entre 3 y 120 letras"),
    categoryId: z.uuid({ error: "Elige una categoría" }),
    priceBs: required(parseBs, money("Escribe un precio mayor que 0")),
    compareAtBs: optional(parseBs, money("Escribe el precio anterior en Bs")),
    minAge: optional(toNumber, int(0, 99, "La edad mínima debe estar entre 0 y 99")),
    minPlayers: optional(toNumber, int(1, 99, "El mínimo de jugadores debe ser 1 o más")),
    maxPlayers: optional(toNumber, int(1, 99, "El máximo de jugadores debe ser 1 o más")),
    stock: optional(toNumber, int(0, 100_000, "El stock debe ser un número entero, 0 o más")),
    description: z.string().trim().max(2000, "La descripción puede tener hasta 2000 letras").optional(),
    isNew: z.boolean(),
    isActive: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.compareAtBs !== undefined && v.compareAtBs <= v.priceBs) {
      ctx.addIssue({ code: "custom", path: ["compareAtBs"], message: "El precio anterior debe ser mayor que el precio" });
    }
    if (v.minPlayers !== undefined && v.maxPlayers !== undefined && v.maxPlayers < v.minPlayers) {
      ctx.addIssue({ code: "custom", path: ["maxPlayers"], message: "El máximo de jugadores debe ser igual o mayor que el mínimo" });
    }
  })
  .transform((v) => ({
    name: v.name,
    categoryId: v.categoryId,
    priceCents: bsToCents(v.priceBs),
    compareAtCents: v.compareAtBs === undefined ? null : bsToCents(v.compareAtBs),
    minAge: v.minAge ?? null,
    minPlayers: v.minPlayers ?? null,
    maxPlayers: v.maxPlayers ?? null,
    stock: v.stock ?? null,
    description: v.description || null,
    isNew: v.isNew,
    isActive: v.isActive,
  }));

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductValues = z.output<typeof productInputSchema>;
