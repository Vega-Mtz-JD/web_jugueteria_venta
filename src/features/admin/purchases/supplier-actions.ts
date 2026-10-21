"use server";

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { isAdminSession } from "../guard";

type Result<T = object> = ({ ok: true } & T) | { error: string };
const NOT_ADMIN = { error: "Solo un administrador puede hacer esto" } as const;

const supplierInput = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del proveedor").max(120, "El nombre puede tener hasta 120 letras"),
  contactName: z.string().trim().max(120),
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[\d\s-]{7,20}$/.test(v), "Escribe el WhatsApp, por ejemplo 71234567 o +591 71234567"),
  notes: z.string().trim().max(1000),
  isActive: z.boolean(),
});

const row = (v: z.output<typeof supplierInput>) => ({
  name: v.name,
  contact_name: v.contactName || null,
  whatsapp: v.whatsapp || null,
  notes: v.notes || null,
  is_active: v.isActive,
});

export async function saveSupplierAction(id: string | null, input: z.input<typeof supplierInput>): Promise<Result<{ id: string }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  const parsed = supplierInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisa los datos" };
  const supabase = await createServerSupabase();
  if (id) {
    const { error } = await supabase.from("suppliers").update(row(parsed.data)).eq("id", id);
    if (error) return { error: "No pudimos guardar el proveedor. Vuelve a intentarlo." };
    return { ok: true, id };
  }
  const { data, error } = await supabase.from("suppliers").insert(row(parsed.data)).select("id").single();
  if (error) return { error: "No pudimos guardar el proveedor. Vuelve a intentarlo." };
  return { ok: true, id: data.id };
}

/** Un proveedor con compras no se borra (las compras lo necesitan): se desactiva. */
export async function deleteSupplierAction(id: string): Promise<Result<{ outcome: "borrado" | "desactivado" }>> {
  if (!(await isAdminSession())) return NOT_ADMIN;
  if (!z.uuid().safeParse(id).success) return { error: "No encontramos ese proveedor" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error?.code === "23503") {
    const { error: e2 } = await supabase.from("suppliers").update({ is_active: false }).eq("id", id);
    if (e2) return { error: "No pudimos borrar el proveedor. Vuelve a intentarlo." };
    return { ok: true, outcome: "desactivado" };
  }
  if (error) return { error: "No pudimos borrar el proveedor. Vuelve a intentarlo." };
  return { ok: true, outcome: "borrado" };
}
