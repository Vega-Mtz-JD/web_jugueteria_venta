import { createServerSupabase } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string; fullName: string | null; phone: string | null };

/** Usuario con sesión (o null). Lee cookies: usarlo dentro de <Suspense>. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("full_name, phone").eq("id", claims.sub).maybeSingle();
  return {
    id: claims.sub,
    email: (claims.email as string | undefined) ?? "",
    fullName: profile?.full_name ?? null,
    phone: profile?.phone ?? null,
  };
}
