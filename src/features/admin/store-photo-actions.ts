"use server";

import { z } from "zod";
import { invalidateCatalog } from "@/features/catalog/invalidate";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminErrorMessage } from "./errors";
import { isAdminSession } from "./guard";

// Fotos de la tienda (postal de la portada). Los archivos viven en product-images/tienda/.

export type Result = { ok: true } | { error: string };

const NOT_ADMIN = { error: "Solo un administrador puede hacer esto" } as const;
const SAVE_ERROR = "No pudimos guardar la foto. Vuelve a intentarlo.";
const BUCKET = "product-images";
const uuid = z.uuid();
const caption = z.string().trim().min(1, "Escribe una frase corta").max(80, "La frase puede tener hasta 80 letras");

function captionError(value: string): string | null {
  const r = caption.safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? "Escribe una frase corta");
}

export async function addStorePhotoAction(path: string, text: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const supabase = await createServerSupabase();
  const discard = () => supabase.storage.from(BUCKET).remove([path]);
  if (!/^tienda\/[\w.-]{1,120}$/.test(path)) return { error: SAVE_ERROR };
  const problem = captionError(text);
  if (problem) {
    await discard();
    return { error: problem };
  }
  const { data: current } = await supabase.from("store_photos").select("sort_order");
  const sortOrder = Math.max(-1, ...(current ?? []).map((c) => c.sort_order)) + 1;
  const { error } = await supabase.from("store_photos").insert({ path, caption: text.trim(), sort_order: sortOrder });
  if (error) {
    await discard();
    return { error: adminErrorMessage(error, SAVE_ERROR) };
  }
  invalidateCatalog();
  return { ok: true };
}

export async function updateStorePhotoCaptionAction(id: string, text: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(id).success) return { error: SAVE_ERROR };
  const problem = captionError(text);
  if (problem) return { error: problem };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("store_photos").update({ caption: text.trim() }).eq("id", id);
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  invalidateCatalog();
  return { ok: true };
}

export async function moveStorePhotoAction(id: string, direction: "up" | "down"): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(id).success) return { error: SAVE_ERROR };
  const supabase = await createServerSupabase();
  const { data: all, error: listError } = await supabase.from("store_photos").select("id").order("sort_order").order("created_at");
  if (listError || !all) return { error: SAVE_ERROR };
  const ids = all.map((p) => p.id);
  const from = ids.indexOf(id);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= ids.length) return { ok: true };
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const results = await Promise.all(ids.map((photoId, i) => supabase.from("store_photos").update({ sort_order: i }).eq("id", photoId)));
  if (results.some((r) => r.error)) return { error: SAVE_ERROR };
  invalidateCatalog();
  return { ok: true };
}

export async function removeStorePhotoAction(id: string): Promise<Result> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!uuid.safeParse(id).success) return { error: SAVE_ERROR };
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("store_photos").delete().eq("id", id).select("path").maybeSingle();
  if (error) return { error: adminErrorMessage(error, SAVE_ERROR) };
  if (data) await supabase.storage.from(BUCKET).remove([data.path]);
  invalidateCatalog();
  return { ok: true };
}
