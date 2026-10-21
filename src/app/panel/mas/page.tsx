import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRightIcon, ShoppingCartIcon, SettingsIcon, StoreIcon, TruckIcon, UsersIcon } from "lucide-react";
import { PushToggle } from "@/features/admin/push/PushToggle";

export const metadata: Metadata = { title: "Más" };

const LINKS = [
  { href: "/panel/compras", label: "Compras", hint: "Lo que debo, lo que falta llegar y lo que compré", icon: ShoppingCartIcon },
  { href: "/panel/proveedores", label: "Proveedores", hint: "A quién le compro y cuánto le debo", icon: TruckIcon },
  { href: "/panel/ajustes", label: "Ajustes", hint: "Datos de la tienda, QR, envíos y categorías", icon: SettingsIcon },
  { href: "/panel/ajustes#administradores", label: "Administradores", hint: "Quién puede entrar al panel", icon: UsersIcon },
  { href: "/", label: "Ver la tienda", hint: "Lo que ven los compradores", icon: StoreIcon },
] as const;

export default function MasPage() {
  return (
    <>
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Más</h1>
      <div className="mb-6">
        <PushToggle />
      </div>
      <ul className="grid gap-3">
        {LINKS.map(({ href, label, hint, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-16 items-center gap-4 rounded-2xl border border-[#eadcc4] bg-papel p-4 transition-colors hover:border-madera"
            >
              <Icon aria-hidden className="size-6 shrink-0 text-verde" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-muted-foreground">{hint}</span>
              </span>
              <ChevronRightIcon aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
