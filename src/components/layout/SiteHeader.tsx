import Link from "next/link";
import { Suspense } from "react";
import { HeaderAccount, LoginLink } from "@/features/auth/HeaderAccount";
import { CartBadge } from "@/features/cart/CartBadge";
import { Logo } from "@/components/brand/Logo";
import { MobileMenu } from "./MobileMenu";
import { NAV_LINKS } from "./nav-links";

export function SiteHeader({ storeName }: { storeName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-crema/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="mr-auto" aria-label={`${storeName}, ir al inicio`}>
          <Logo storeName={storeName} />
        </Link>
        <nav className="mr-2 hidden items-center gap-7 text-[0.95rem] font-medium md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative py-1 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:scale-x-0 after:bg-verde after:transition-transform hover:after:scale-x-100"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<LoginLink />}>
          <HeaderAccount />
        </Suspense>
        <CartBadge />
        <MobileMenu storeName={storeName} />
      </div>
    </header>
  );
}
