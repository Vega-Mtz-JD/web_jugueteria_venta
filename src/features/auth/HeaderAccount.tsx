import Link from "next/link";
import { getSessionUser } from "./session";
import { UserMenu } from "./UserMenu";

export function LoginLink() {
  return (
    <Link href="/ingresar" className="inline-flex h-11 items-center rounded-full px-3 text-sm font-semibold hover:bg-crema-2">
      Ingresar
    </Link>
  );
}

/** Cuenta en la cabecera. Lee cookies: va dentro de <Suspense fallback={<LoginLink />}>. */
export async function HeaderAccount() {
  const user = await getSessionUser();
  if (!user) return <LoginLink />;
  return <UserMenu name={user.fullName ?? user.email} email={user.email} />;
}
