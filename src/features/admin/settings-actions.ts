"use server";

import { z } from "zod";
import { invalidateCatalog } from "@/features/catalog/invalidate";
import { COORDINATES_ERROR, extractUrl, isGoogleMapsUrl, MAPS_URL_ERROR, parseCoordinates } from "@/features/store/location";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorMessage } from "./errors";
import { isAdminSession } from "./guard";
import { bsTextToCents } from "./product-schema";
import { nextFreeSlug, slugify } from "./slug";

export type Result<T = object> = ({ ok: true } & T) | { error: string };

const NOT_ADMIN = { error: "Solo un administrador puede hacer esto" } as const;
const SAVE_ERROR = "No pudimos guardar. Vuelve a intentarlo.";
const text = (max: number) => z.string().trim().max(max, `Puede tener hasta ${max} letras`);
const name = z.string().trim().min(2, "Escribe un nombre").max(80, "El nombre puede tener hasta 80 letras");
const order = z.number().int().min(0).max(999);
const id = z.uuid().nullable();

/** Primer mensaje de zod, o null si los datos sirven. */
function invalid(r: { success: boolean; error?: z.ZodError }): string | null {
  return r.success ? null : (r.error?.issues[0]?.message ?? "Revisa los datos");
}

/** Error de unicidad o de clave foránea con un mensaje propio; si no, el genérico. */
function dbError(error: { code?: string }, messages: { duplicate?: string; inUse?: string } = {}): { error: string } {
  if (error.code === "23505" && messages.duplicate) return { error: messages.duplicate };
  if (error.code === "23503" && messages.inUse) return { error: messages.inUse };
  return { error: SAVE_ERROR };
}

// Tienda y tarifas ---------------------------------------------------------------------------------

const storeInput = z.object({
  storeName: name,
  tagline: text(120),
  whatsappPhone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[\d\s-]{8,20}$/.test(v), "Escribe el WhatsApp con código de país, por ejemplo +591 71234567"),
  address: text(200),
  pickupHours: text(120),
  zone: text(60).default(""),
  // Se acepta el mensaje entero que comparte Google Maps: se guarda solo el enlace.
  mapsUrl: z
    .string()
    .default("")
    .transform(extractUrl)
    .refine((v) => v === "" || isGoogleMapsUrl(v), MAPS_URL_ERROR),
  coordinates: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || parseCoordinates(v) !== null, COORDINATES_ERROR),
});

export async function saveStoreAction(input: z.input<typeof storeInput>): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = storeInput.safeParse(input);
  const problem = invalid(parsed);
  if (problem || !parsed.data) return { error: problem ?? SAVE_ERROR };
  const v = parsed.data;
  const coordinates = v.coordinates ? parseCoordinates(v.coordinates) : null;
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("store_settings")
    .update({
      store_name: v.storeName,
      tagline: v.tagline || null,
      whatsapp_phone: v.whatsappPhone || null,
      address: v.address || null,
      pickup_hours: v.pickupHours || null,
      zone: v.zone || null,
      maps_url: v.mapsUrl || null,
      latitude: coordinates?.latitude ?? null,
      longitude: coordinates?.longitude ?? null,
    })
    .eq("id", 1);
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true };
}

export async function saveFeesAction(input: { homeBs: string; meetingBs: string }): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const home = bsTextToCents(input.homeBs);
  const meeting = bsTextToCents(input.meetingBs);
  if (home === null || meeting === null || home > 100_000 || meeting > 100_000) return { error: "Escribe las tarifas en Bs (0 si no se cobra)" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("store_settings").update({ delivery_fee_home_cents: home, delivery_fee_meeting_cents: meeting }).eq("id", 1);
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true };
}

// Zonas y puntos de encuentro ----------------------------------------------------------------------

const zoneInput = z.object({ id, name, mode: z.enum(["domicilio", "punto"]), sortOrder: order, isActive: z.boolean() });

export async function saveZoneAction(input: z.input<typeof zoneInput>): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = zoneInput.safeParse(input);
  const problem = invalid(parsed);
  if (problem || !parsed.data) return { error: problem ?? SAVE_ERROR };
  const v = parsed.data;
  const row = { name: v.name, mode: v.mode, sort_order: v.sortOrder, is_active: v.isActive };
  const supabase = await createServerSupabase();
  const { error } = v.id ? await supabase.from("delivery_zones").update(row).eq("id", v.id) : await supabase.from("delivery_zones").insert(row);
  if (error) return dbError(error, { duplicate: "Ya hay una zona con ese nombre" });
  invalidateCatalog();
  return { ok: true };
}

const pointInput = z.object({ id, name, reference: text(160), sortOrder: order, isActive: z.boolean() });

export async function savePointAction(input: z.input<typeof pointInput>): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = pointInput.safeParse(input);
  const problem = invalid(parsed);
  if (problem || !parsed.data) return { error: problem ?? SAVE_ERROR };
  const v = parsed.data;
  const row = { name: v.name, reference: v.reference || null, sort_order: v.sortOrder, is_active: v.isActive };
  const supabase = await createServerSupabase();
  const { error } = v.id ? await supabase.from("meeting_points").update(row).eq("id", v.id) : await supabase.from("meeting_points").insert(row);
  if (error) return dbError(error, { duplicate: "Ya hay un punto con ese nombre" });
  invalidateCatalog();
  return { ok: true };
}

/** Borra una zona o punto; si algún pedido lo usa, solo lo desactiva para no perder el historial. */
async function deleteOrDeactivate(table: "delivery_zones" | "meeting_points", rowId: string): Promise<Result<{ outcome: "borrado" | "desactivado" }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!z.uuid().safeParse(rowId).success) return { error: "No encontramos ese registro" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from(table).delete().eq("id", rowId);
  if (error?.code === "23503") {
    const { error: e2 } = await supabase.from(table).update({ is_active: false }).eq("id", rowId);
    if (e2) return dbError(e2);
    invalidateCatalog();
    return { ok: true, outcome: "desactivado" };
  }
  if (error) return dbError(error);
  invalidateCatalog();
  return { ok: true, outcome: "borrado" };
}

export async function deleteZoneAction(zoneId: string) {
  return deleteOrDeactivate("delivery_zones", zoneId);
}

export async function deletePointAction(pointId: string) {
  return deleteOrDeactivate("meeting_points", pointId);
}

// Billeteras QR --------------------------------------------------------------------------------------

const walletInput = z.object({
  id,
  name,
  accountHolder: text(120),
  sortOrder: order,
  isActive: z.boolean(),
  qrPath: z
    .string()
    .regex(/^qr\/[0-9a-f-]{36}\.(webp|jpg|png|heic|img)$/, "No pudimos guardar el QR")
    .optional(),
});

export async function saveWalletAction(input: z.input<typeof walletInput>): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = walletInput.safeParse(input);
  const problem = invalid(parsed);
  if (problem || !parsed.data) return { error: problem ?? SAVE_ERROR };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const row = { name: v.name, account_holder: v.accountHolder || null, sort_order: v.sortOrder, is_active: v.isActive, ...(v.qrPath ? { qr_path: v.qrPath } : {}) };
  let previous: string | null = null;
  if (v.id && v.qrPath) {
    const { data } = await supabase.from("payment_methods").select("qr_path").eq("id", v.id).maybeSingle();
    previous = data?.qr_path ?? null;
  }
  if (!v.id && !v.qrPath) return { error: "Sube la imagen del QR" };
  const { error } = v.id
    ? await supabase.from("payment_methods").update(row).eq("id", v.id)
    : await supabase.from("payment_methods").insert({ ...row, qr_path: v.qrPath as string });
  if (error) return dbError(error, { duplicate: "Ya hay una billetera con ese nombre" });
  // El QR anterior ya no se usa (los de ejemplo viven en /public y no se tocan).
  if (previous && !previous.startsWith("/")) await supabase.storage.from("store-assets").remove([previous]);
  invalidateCatalog();
  return { ok: true };
}

export async function deleteWalletAction(walletId: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!z.uuid().safeParse(walletId).success) return { error: "No encontramos esa billetera" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("payment_methods").delete().eq("id", walletId).select("qr_path").maybeSingle();
  if (error) return dbError(error);
  if (data && !data.qr_path.startsWith("/")) await supabase.storage.from("store-assets").remove([data.qr_path]);
  invalidateCatalog();
  return { ok: true };
}

// Categorías ---------------------------------------------------------------------------------------

const categoryInput = z.object({ id, name, sortOrder: order });

export async function saveCategoryAction(input: z.input<typeof categoryInput>): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = categoryInput.safeParse(input);
  const problem = invalid(parsed);
  if (problem || !parsed.data) return { error: problem ?? SAVE_ERROR };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  if (v.id) {
    // La dirección web (slug) se mantiene: los enlaces del catálogo siguen sirviendo.
    const { error } = await supabase.from("categories").update({ name: v.name, sort_order: v.sortOrder }).eq("id", v.id);
    if (error) return dbError(error);
  } else {
    const base = slugify(v.name);
    const { data: used } = await supabase.from("categories").select("slug").like("slug", `${base}%`);
    const { error } = await supabase
      .from("categories")
      .insert({ name: v.name, sort_order: v.sortOrder, slug: nextFreeSlug(base, (used ?? []).map((u) => u.slug)) });
    if (error) return dbError(error, { duplicate: "Ya hay una categoría con ese nombre" });
  }
  invalidateCatalog();
  return { ok: true };
}

export async function deleteCategoryAction(categoryId: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!z.uuid().safeParse(categoryId).success) return { error: "No encontramos esa categoría" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return dbError(error, { inUse: "Esta categoría tiene productos; muévelos primero" });
  invalidateCatalog();
  return { ok: true };
}

// Administradores y productos de prueba -------------------------------------------------------------

export async function setAdminAction(email: string, makeAdmin: boolean): Promise<Result> {
  const parsed = z.email({ error: "Escribe un correo válido" }).safeParse(email.trim());
  if (!parsed.success) return { error: "Escribe un correo válido" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_set_admin", { p_email: parsed.data, p_make_admin: makeAdmin });
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  return { ok: true };
}

export async function deleteSampleProductsAction(confirmation: string): Promise<Result<{ deleted: number }>> {
  if (confirmation.trim() !== "BORRAR") return { error: "Escribe BORRAR para confirmar" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("delete_sample_products");
  if (error) return { error: adminErrorMessage(error, "No pudimos borrar los productos de prueba. Vuelve a intentarlo.") };
  invalidateCatalog();
  return { ok: true, deleted: data };
}
