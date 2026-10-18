import { ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { MobileMenu } from "./MobileMenu";
import { NAV_LINKS } from "./nav-links";

export function SiteHeader({ storeName }: { storeName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-crema/75 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="mr-auto" aria-label={`${storeName}, ir al inicio`}>
          <Logo storeName={storeName} />
        </Link>
        <nav className="hidden items-center gap-7 text-[0.95rem] font-medium md:flex">
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
        <Link
          href="/carrito"
          prefetch={false}
          aria-label="Ver carrito"
          className="inline-flex size-11 items-center justify-center rounded-full bg-verde text-crema transition-colors hover:bg-verde-2"
        >
          <ShoppingBagIcon className="size-5" />
        </Link>
        <MobileMenu storeName={storeName} />
      </div>
    </header>
  );
}
