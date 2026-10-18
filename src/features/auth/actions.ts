"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { normalizePhone } from "@/features/checkout/schema";
import { createServerSupabase } from "@/lib/supabase/server";
import { safeRedirectPath } from "./redirect";

export type AuthState = { error?: string; message?: string };

async function origin(): Promise<string> {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
}

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email: text(form, "email"), password: String(form.get("password") ?? "") });
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Confirma tu correo antes de ingresar. Revisa tu bandeja de entrada." };
    return { error: "Correo o contraseña incorrectos" };
  }
  redirect(safeRedirectPath(text(form, "siguiente")));
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(3, { error: "Escribe tu nombre completo" }),
  email: z.email({ error: "Escribe un correo válido" }),
  password: z.string().min(8, { error: "La contraseña debe tener al menos 8 caracteres" }),
  phone: z.string().trim().optional(),
});

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    fullName: text(form, "fullName"),
    email: text(form, "email"),
    password: String(form.get("password") ?? ""),
    phone: text(form, "phone") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const phone = parsed.data.phone ? normalizePhone(parsed.data.phone) : null;
  if (parsed.data.phone && !phone) return { error: "Escribe un celular de 8 dígitos (empieza con 6 o 7)" };

  const next = safeRedirectPath(text(form, "siguiente"));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, phone }, emailRedirectTo: `${await origin()}${next}` },
  });
  if (error) {
    if (error.code === "user_already_exists") return { error: "Ese correo ya tiene una cuenta. ¿Quieres ingresar?" };
    if (error.code === "weak_password") return { error: "Elige una contraseña más segura" };
    return { error: "No pudimos crear la cuenta. Vuelve a intentarlo en un momento." };
  }
  if (!data.session) return { message: "Te enviamos un correo para confirmar tu cuenta. Ábrelo y toca «Confirmar mi cuenta»." };
  redirect(next);
}

export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const supabase = await createServerSupabase();
  await supabase.auth.resetPasswordForEmail(text(form, "email"));
  // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
  return { message: "Si ese correo tiene una cuenta, te enviamos un enlace para cambiar la contraseña." };
}

export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres" };
  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "El enlace venció. Pide uno nuevo desde «¿Olvidaste tu contraseña?»." };
  return { message: "Tu contraseña se actualizó." };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/");
}
