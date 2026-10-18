"use client";

import { MenuIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NAV_LINKS } from "./nav-links";

export function MobileMenu({ storeName }: { storeName: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Abrir menú" className="md:hidden">
          <MenuIcon className="size-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="overscroll-contain bg-crema px-6 pt-14">
        <SheetTitle className="font-serif text-2xl">{storeName}</SheetTitle>
        <nav className="mt-4 flex flex-col">
          {NAV_LINKS.map((link) => (
            <SheetClose asChild key={link.href}>
              <Link href={link.href} className="border-b border-border py-4 text-lg font-medium">
                {link.label}
              </Link>
            </SheetClose>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
