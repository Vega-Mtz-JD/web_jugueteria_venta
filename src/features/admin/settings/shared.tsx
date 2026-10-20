"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

export const field = "grid gap-1.5 text-sm font-semibold";
export const control =
  "h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Una sección de Ajustes: región con nombre (para lectores y pruebas) y ancla. */
export function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="scroll-mt-20 rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id={`${id}-titulo`} className="font-serif text-xl font-bold">
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Ejecuta una Server Action, muestra "Guardado" o el error, y recarga los datos. */
export function useSave() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  function run<T extends { ok: true } | { error: string }>(action: () => Promise<T>, onOk?: (r: Extract<T, { ok: true }>) => string | void) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setStatus({ ok: false, text: result.error });
        return;
      }
      const text = onOk?.(result as Extract<T, { ok: true }>);
      setStatus({ ok: true, text: text || "Guardado" });
      router.refresh();
    });
  }
  return { pending, status, setStatus, run };
}

export function SaveStatus({ status }: { status: { ok: boolean; text: string } | null }) {
  if (!status) return null;
  return (
    <p role={status.ok ? "status" : "alert"} className={cn("text-sm font-medium", status.ok ? "text-verde" : "text-rojo")}>
      {status.text}
    </p>
  );
}
