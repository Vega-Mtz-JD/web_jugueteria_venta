import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { PanelNav } from "./PanelNav";

/** Estructura del panel: encabezado compacto, navegación y contenido (sin el pie de la tienda). */
export function PanelShell({ storeName, children }: { storeName: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:flex-row">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-crema/90 px-4 backdrop-blur lg:fixed lg:inset-x-0 lg:z-50 lg:px-6">
        <Link href="/panel" aria-label={`Panel de ${storeName}`}>
          <Logo storeName={storeName} />
        </Link>
        <span className="rounded-full bg-verde px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-crema">Panel</span>
      </header>
      <PanelNav />
      <main id="contenido" tabIndex={-1} className="flex-1 px-4 pb-28 pt-6 outline-none sm:px-6 lg:pb-10 lg:pt-20">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
