import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectPath } from "@/features/auth/redirect";
import { createServerSupabase } from "@/lib/supabase/server";

// Vuelta de un proveedor externo (Google, plan 2 tarea 9) con ?code=…
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeRedirectPath(request.nextUrl.searchParams.get("siguiente"));
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  return NextResponse.redirect(new URL("/ingresar?error=enlace", request.url));
}
