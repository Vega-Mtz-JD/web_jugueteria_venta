import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/features/auth/redirect";
import { createServerSupabase } from "@/lib/supabase/server";

// Enlaces de los correos (confirmar cuenta, recuperar contraseña) con token_hash.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // Recuperar contraseña siempre termina en /nueva-clave; confirmar cuenta, en el inicio.
  const next = type === "recovery" ? "/nueva-clave" : safeRedirectPath(searchParams.get("siguiente"));

  if (tokenHash && type) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/ingresar?error=enlace", request.url));
}
