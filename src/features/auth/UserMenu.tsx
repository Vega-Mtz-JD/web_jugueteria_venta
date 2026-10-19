"use client";

import { ChevronDownIcon, LogOutIcon, PackageIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "./actions";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const [pending, startTransition] = useTransition();
  const firstName = name.split(" ")[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold outline-none hover:bg-crema-2 focus-visible:ring-3 focus-visible:ring-ring/50">
        <UserIcon aria-hidden className="size-5" />
        <span className="max-w-24 truncate">{firstName}</span>
        <ChevronDownIcon aria-hidden className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-papel">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/pedidos">
            <PackageIcon aria-hidden />
            Mis pedidos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={pending} onSelect={() => startTransition(() => signOut())}>
          <LogOutIcon aria-hidden />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
