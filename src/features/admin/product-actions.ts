"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { CATALOG_TAG } from "@/features/catalog/cached";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorMessage } from "./errors";
import { isAdminSession } from "./guard";
import { productInputSchema, type ProductInput } from "./product-schema";
import { nextFreeSlug, slugify } from "./slug";

export type Result<T = object> = ({ ok: true } & T) | { error: string };

const NOT_ADMIN = { error: "Solo un administrador puede hacer esto" } as const;
const MAX_PHOTOS = 5;
const uuid = z.uuid();

/** Fotos subidas al bucket (las de prueba viven en /public y empiezan con "/"). */
const storagePaths = (paths: string[]) => paths.filter((p) => !p.startsWith("/"));

export async function saveProductAction(
  productId: string | null,
  input: ProductInput,
): Promise<Result<{ id: string }> | { error: string; fieldErrors: Record<string, string> }> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Revisa los datos marcados", fieldErrors };
  }
  const v = parsed.data;
  const row = {
    name: v.name,
    category_id: v.categoryId,
    price_cents: v.priceCents,
    compare_at_cents: v.compareAtCents,
    min_age: v.minAge,
    min_players: v.minPlayers,
    max_players: v.maxPlayers,
    description: v.description,
    is_new: v.isNew,
    is_active: v.isActive,
  };
  const supabase = await createServerSupabase();

  if (productId) {
    if (!uuid.safeParse(productId).success) return { error: "No encontramos ese producto" };
    // El stock no se edita aquí (va por contar estante o ±) y la dirección web no cambia: los enlaces compartidos siguen sirviendo.
    const { error } = await supabase.from("products").update(row).eq("id", productId);
    if (error) return { error: "No pudimos guardar el producto. Vuelve a intentarlo." };
    updateTag(CATALOG_TAG);
    return { ok: true, id: productId };
  }

  const base = slugify(v.name);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data: used } = await supabase.from("products").select("slug").like("slug", `${base}%`);
    const slug = nextFreeSlug(base, (used ?? []).map((u) => u.slug));
    const { data, error } = await supabase
      .from("products")
      .insert({ ...row, slug, stock: v.stock ?? 0 })
      .select("id")
      .single();
    if (!error) {
      updateTag(CATALOG_TAG);
      return { ok: true, id: data.id };
    }
    if (error.code !== "23505") break; // otra persona creó la misma dirección a la vez: probar la siguiente
  }
  return { error: "No pudimos crear el producto. Vuelve a intentarlo." };
}

export async function deleteProductAction(productId: string): Promise<Result<{ outcome: "borrado" | "oculto" }>> {
  if (!uuid.safeParse(productId).success) return { error: "No encontramos ese producto" };
  const supabase = await createServerSupabase();
  const { data: images } = await supabase.from("product_images").select("path").eq("product_id", productId);
  const { data, error } = await supabase.rpc("admin_delete_product", { p_product_id: productId });
  if (error) return { error: adminErrorMessage(error, "No pudimos borrar el producto. Vuelve a intentarlo.") };
  if (data === "borrado") {
    const paths = storagePaths((images ?? []).map((i) => i.path));
    if (paths.length) await supabase.storage.from("product-images").remove(paths);
  }
  updateTag(CATALOG_TAG);
  return { ok: true, outcome: data === "borrado" ? "borrado" : "oculto" };
}

export async function addProductPhotoAction(productId: string, path: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(productId).success || !path.startsWith(`${productId}/`) || path.length > 300) {
    return { error: "No pudimos guardar la foto" };
  }
  const supabase = await createServerSupabase();
  const { data: current } = await supabase.from("product_images").select("sort_order").eq("product_id", productId);
  if ((current?.length ?? 0) >= MAX_PHOTOS) {
    await supabase.storage.from("product-images").remove([path]);
    return { error: `Cada producto puede tener hasta ${MAX_PHOTOS} fotos` };
  }
  const sortOrder = Math.max(-1, ...(current ?? []).map((c) => c.sort_order)) + 1;
  const { error } = await supabase.from("product_images").insert({ product_id: productId, path, sort_order: sortOrder });
  if (error) return { error: "No pudimos guardar la foto. Vuelve a intentarlo." };
  updateTag(CATALOG_TAG);
  return { ok: true };
}

export async function removeProductPhotoAction(imageId: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(imageId).success) return { error: "No encontramos esa foto" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("product_images").delete().eq("id", imageId).select("path").maybeSingle();
  if (error || !data) return { error: "No pudimos quitar la foto. Vuelve a intentarlo." };
  const paths = storagePaths([data.path]);
  if (paths.length) await supabase.storage.from("product-images").remove(paths);
  updateTag(CATALOG_TAG);
  return { ok: true };
}

/** La foto elegida pasa a ser la primera; las demás conservan su orden. */
export async function makeMainPhotoAction(imageId: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(imageId).success) return { error: "No encontramos esa foto" };
  const supabase = await createServerSupabase();
  const { data: img } = await supabase.from("product_images").select("product_id").eq("id", imageId).maybeSingle();
  if (!img) return { error: "No encontramos esa foto" };
  const { data: all } = await supabase.from("product_images").select("id, sort_order").eq("product_id", img.product_id).order("sort_order");
  const ordered = [imageId, ...(all ?? []).map((i) => i.id).filter((id) => id !== imageId)];
  const results = await Promise.all(ordered.map((id, i) => supabase.from("product_images").update({ sort_order: i }).eq("id", id)));
  if (results.some((r) => r.error)) return { error: "No pudimos cambiar la foto principal. Vuelve a intentarlo." };
  updateTag(CATALOG_TAG);
  return { ok: true };
}

export async function adjustStockAction(productId: string, delta: number): Promise<Result<{ stock: number }>> {
  if (!uuid.safeParse(productId).success || !Number.isInteger(delta) || Math.abs(delta) > 1000) return { error: "Revisa la cantidad" };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_adjust_stock", { p_product_id: productId, p_delta: delta });
  if (error) return { error: adminErrorMessage(error, "No pudimos cambiar el stock. Vuelve a intentarlo.") };
  updateTag(CATALOG_TAG);
  return { ok: true, stock: data };
}

export async function countShelfAction(productId: string, counted: number): Promise<Result<{ stock: number }>> {
  if (!uuid.safeParse(productId).success || !Number.isInteger(counted) || counted < 0 || counted > 100_000) {
    return { error: "Escribe cuántas unidades contaste" };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_count_shelf", { p_product_id: productId, p_counted: counted });
  if (error) return { error: adminErrorMessage(error, "No pudimos guardar el conteo. Vuelve a intentarlo.") };
  updateTag(CATALOG_TAG);
  return { ok: true, stock: data };
}

const manualSaleInput = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1, "La cantidad debe ser entre 1 y 100").max(100, "La cantidad debe ser entre 1 y 100"),
  channel: z.enum(["tienda", "whatsapp"]),
  unitPriceCents: z.number().int().min(0, "Escribe el precio de venta").max(100_000_000, "Escribe el precio de venta"),
  note: z.string().trim().max(200, "La nota puede tener hasta 200 letras").optional(),
});

export async function recordManualSaleAction(input: z.input<typeof manualSaleInput>): Promise<Result> {
  const parsed = manualSaleInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos de la venta" };
  const v = parsed.data;
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_record_manual_sale", {
    p_product_id: v.productId,
    p_quantity: v.quantity,
    p_channel: v.channel,
    p_unit_price_cents: v.unitPriceCents,
    p_note: v.note || undefined,
  });
  if (error) return { error: adminErrorMessage(error, "No pudimos registrar la venta. Vuelve a intentarlo.") };
  updateTag(CATALOG_TAG);
  return { ok: true };
}

export async function voidManualSaleAction(saleId: string): Promise<Result> {
  if (!uuid.safeParse(saleId).success) return { error: "No encontramos esa venta" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("admin_void_manual_sale", { p_sale_id: saleId });
  if (error) return { error: adminErrorMessage(error, "No pudimos anular la venta. Vuelve a intentarlo.") };
  updateTag(CATALOG_TAG);
  return { ok: true };
}
