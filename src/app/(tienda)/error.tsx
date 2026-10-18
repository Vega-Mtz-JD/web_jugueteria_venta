"use client"; // Los límites de error deben ser Client Components.

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TiendaError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <span aria-hidden className="text-6xl">
        🎲
      </span>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">No pudimos cargar esta página</h1>
      <p className="mt-3 text-muted-foreground">
        Puede ser un problema de conexión. Vuelve a intentarlo en unos segundos.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button size="lg" onClick={() => retry()}>
          Reintentar
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">Ir al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
