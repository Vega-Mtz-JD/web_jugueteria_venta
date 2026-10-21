"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { callAction } from "../call-action";
import { ConfirmButton } from "../ConfirmButton";
import { control, field } from "../settings/shared";
import type { SupplierDetail } from "./queries";
import { deleteSupplierAction, saveSupplierAction } from "./supplier-actions";

type Status = { ok: boolean; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm font-medium text-verde" : "text-sm font-medium text-rojo"}>
      {status.text}
    </p>
  );
}

function values(form: HTMLFormElement) {
  const f = new FormData(form);
  const t = (k: string) => String(f.get(k) ?? "");
  return { name: t("name"), contactName: t("contactName"), whatsapp: t("whatsapp"), notes: t("notes"), isActive: f.get("isActive") === "on" };
}

/** Alta rápida desde la lista: al guardar, lleva a la ficha del proveedor. */
export function NewSupplierForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  return (
    <section aria-labelledby="nuevo-proveedor" className="rounded-3xl border border-[#eadcc4] bg-papel p-4 sm:p-6">
      <h2 id="nuevo-proveedor" className="font-serif text-xl font-bold">
        Nuevo proveedor
      </h2>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const v = { ...values(e.currentTarget), isActive: true };
          startTransition(async () => {
            const result = await callAction(() => saveSupplierAction(null, v));
            if ("error" in result) return setStatus({ ok: false, text: result.error });
            router.push(`/panel/proveedores/${result.id}`);
          });
        }}
      >
        <label className={field}>
          Nombre
          <input name="name" maxLength={120} className={control} />
        </label>
        <label className={field}>
          Persona de contacto
          <input name="contactName" maxLength={120} className={control} />
        </label>
        <label className={field}>
          WhatsApp
          <input name="whatsapp" type="tel" placeholder="71234567" className={control} />
        </label>
        <input type="hidden" name="notes" value="" />
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Agregar proveedor"}
          </Button>
          <StatusLine status={status} />
        </div>
      </form>
    </section>
  );
}

export function SupplierForm({ supplier }: { supplier: SupplierDetail }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const form = useRef<HTMLFormElement>(null);
  // "Borrar" puede desactivarlo desde fuera del formulario: seguir el valor de la base.
  const [active, setActive] = useState(supplier.isActive);
  const [seenActive, setSeenActive] = useState(supplier.isActive);
  if (supplier.isActive !== seenActive) {
    setSeenActive(supplier.isActive);
    setActive(supplier.isActive);
  }

  return (
    <div className="grid gap-4">
      <form
        ref={form}
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = values(e.currentTarget);
          startTransition(async () => {
            const result = await callAction(() => saveSupplierAction(supplier.id, v));
            setStatus("error" in result ? { ok: false, text: result.error } : { ok: true, text: "Guardado" });
            if (!("error" in result)) router.refresh();
          });
        }}
      >
        <label className={field}>
          Nombre
          <input name="name" defaultValue={supplier.name} maxLength={120} className={control} />
        </label>
        <label className={field}>
          Persona de contacto
          <input name="contactName" defaultValue={supplier.contactName ?? ""} maxLength={120} className={control} />
        </label>
        <label className={field}>
          WhatsApp
          <input name="whatsapp" type="tel" defaultValue={supplier.whatsapp ?? ""} className={control} />
        </label>
        <label className="flex min-h-11 items-center gap-2 self-end font-semibold">
          <input name="isActive" type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-verde" />
          Activo
        </label>
        <label className={`${field} sm:col-span-2`}>
          Notas (detalles por arreglar, condiciones, etc.)
          <textarea name="notes" defaultValue={supplier.notes ?? ""} maxLength={1000} rows={3} className={`${control} h-auto py-2`} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Guardar
          </Button>
          <ConfirmButton
            label="Borrar proveedor"
            confirmLabel="Sí, borrar"
            question="¿Borrar este proveedor? Si tiene compras, solo se desactiva."
            disabled={pending}
            onConfirm={() =>
              startTransition(async () => {
                const result = await callAction(() => deleteSupplierAction(supplier.id));
                if ("error" in result) return setStatus({ ok: false, text: result.error });
                if (result.outcome === "borrado") return router.push("/panel/proveedores?borrado=1");
                setStatus({ ok: true, text: "Se desactivó porque tiene compras" });
                router.refresh();
              })
            }
          />
          <StatusLine status={status} />
        </div>
      </form>
    </div>
  );
}
