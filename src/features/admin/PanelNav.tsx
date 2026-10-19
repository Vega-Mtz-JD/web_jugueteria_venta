"use client";

import { HomeIcon, MenuIcon, PackageIcon, ReceiptTextIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/panel", label: "Inicio", icon: HomeIcon },
  { href: "/panel/pedidos", label: "Pedidos", icon: ReceiptTextIcon },
  { href: "/panel/productos", label: "Productos", icon: PackageIcon },
  { href: "/panel/mas", label: "Más", icon: MenuIcon },
] as const;

function isCurrent(pathname: string, href: string) {
  if (href === "/panel") return pathname === "/panel";
  if (href === "/panel/mas") return pathname === "/panel/mas" || pathname.startsWith("/panel/ajustes");
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Barra inferior en el celular y columna lateral desde 1024 px. */
export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Panel"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-papel/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:sticky lg:top-0 lg:h-dvh lg:w-56 lg:shrink-0 lg:border-t-0 lg:border-r lg:bg-papel lg:pb-0 lg:pt-20"
    >
      <ul className="grid grid-cols-4 lg:flex lg:flex-col lg:gap-1 lg:px-3">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold text-tinta-suave lg:min-h-11 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-xl lg:px-3 lg:text-sm",
                  current ? "text-verde lg:bg-crema-2" : "hover:text-tinta lg:hover:bg-crema-2/60",
                )}
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
