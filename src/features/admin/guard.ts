import { notFound } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/features/auth/session";

/**
 * Usuario administrador o 404 (a un cliente común el panel no le existe).
 * Lee cookies: usarlo dentro de <Suspense>. Las funciones RPC vuelven a comprobarlo en la base.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user?.isAdmin) notFound();
  return user;
}

/** Para Server Actions: true si quien llama es administrador (la base lo vuelve a validar). */
export async function isAdminSession(): Promise<boolean> {
  return (await getSessionUser())?.isAdmin ?? false;
}
