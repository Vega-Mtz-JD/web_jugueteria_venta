"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { SettingsData } from "../queries";
import { deleteSampleProductsAction, setAdminAction } from "../settings-actions";
import { ConfirmButton } from "../ConfirmButton";
import { control, SaveStatus, useSave } from "./shared";

export function AdminsEditor({ admins, me }: { admins: SettingsData["admins"]; me: string }) {
  const { pending, status, run } = useSave();
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {admins.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#eadcc4] bg-background/40 px-4 py-3">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">
                {a.fullName ?? "Sin nombre"}
                {a.id === me && <span className="ml-2 text-sm font-normal text-muted-foreground">(tú)</span>}
              </span>
              <span className="block break-all text-sm text-muted-foreground">{a.email}</span>
            </span>
            <ConfirmButton label="Quitar" confirmLabel="Sí, quitar" question="¿Quitarle el acceso al panel?" disabled={pending} onConfirm={() => run(() => setAdminAction(a.email, false), () => "Se quitó el acceso")} />
          </li>
        ))}
      </ul>
      <form
        ref={form}
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const email = String(new FormData(e.currentTarget).get("email") ?? "");
          run(
            () => setAdminAction(email, true),
            () => {
              form.current?.reset();
              return "Administrador agregado";
            },
          );
        }}
      >
        <label className="grid flex-1 basis-56 gap-1.5 text-sm font-semibold">
          Correo
          <input name="email" type="email" autoComplete="off" placeholder="correo de su cuenta en la tienda" className={control} />
        </label>
        <Button type="submit" disabled={pending}>
          Agregar administrador
        </Button>
      </form>
      <SaveStatus status={status} />
    </div>
  );
}

export function SampleProductsButton({ count }: { count: number }) {
  const { pending, status, run } = useSave();
  if (count === 0) return <p className="text-muted-foreground">Ya no quedan productos de prueba.</p>;
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const confirmation = String(new FormData(e.currentTarget).get("confirm") ?? "");
        run(
          () => deleteSampleProductsAction(confirmation),
          (r) => `Listo: se quitaron ${r.deleted} productos de prueba`,
        );
      }}
    >
      <p>
        Hay {count} productos de ejemplo. Los que ya tienen pedidos se ocultan; los demás se borran. <strong>No se puede deshacer.</strong>
      </p>
      <label className="grid max-w-xs gap-1.5 text-sm font-semibold">
        Escribe BORRAR para confirmar
        <input name="confirm" autoComplete="off" className={control} />
      </label>
      <Button type="submit" variant="outline" className="justify-self-start border-rojo text-rojo hover:bg-rojo/10" disabled={pending}>
        Borrar productos de prueba
      </Button>
      <SaveStatus status={status} />
    </form>
  );
}
