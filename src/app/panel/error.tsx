"use client"; // Los límites de error deben ser Client Components.

import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Error dentro del panel: se queda en el panel (no la pantalla de "tienda no disponible"). */
export default function PanelError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
      <span aria-hidden className="text-6xl">
        📶
      </span>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">No pudimos cargar esta página</h1>
      <p className="mt-3 text-muted-foreground">Puede ser la señal del celular. Revisa tu conexión y vuelve a intentarlo.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => retry()}>
          Reintentar
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/panel">Ir al inicio del panel</Link>
        </Button>
      </div>
    </div>
  );
}
