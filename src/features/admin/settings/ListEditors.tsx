"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import type { SettingsData } from "../queries";
import {
  deleteCategoryAction,
  deletePointAction,
  deleteZoneAction,
  saveCategoryAction,
  savePointAction,
  saveZoneAction,
} from "../settings-actions";
import { ConfirmButton } from "../ConfirmButton";
import { control, field, SaveStatus, useSave } from "./shared";

const MODE_LABEL = { domicilio: "A domicilio", punto: "Punto de encuentro" } as const;
const row = "grid gap-3 rounded-2xl border border-[#eadcc4] bg-background/40 p-3";
const deleted = (r: { outcome: "borrado" | "desactivado" }) => (r.outcome === "desactivado" ? "Se desactivó porque hay pedidos que la usan" : "Borrado");

function OrderInput({ value, label }: { value: number; label: string }) {
  return (
    <label className={field}>
      {label}
      <input name="sortOrder" type="number" inputMode="numeric" min={0} max={999} defaultValue={value} className={`${control} w-24`} />
    </label>
  );
}

function ActiveCheck({ value }: { value: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2 font-semibold">
      <input name="isActive" type="checkbox" defaultChecked={value} className="size-5 accent-verde" />
      Activo
    </label>
  );
}

const num = (f: FormData, k: string) => Number(f.get(k) ?? 0) || 0;

// Zonas ----------------------------------------------------------------------------------------------

function ZoneRow({ zone }: { zone: SettingsData["zones"][number] }) {
  const { pending, status, run } = useSave();
  return (
    <li>
      <form
        className={row}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() =>
            saveZoneAction({ id: zone.id, name: String(f.get("name")), mode: f.get("mode") as "domicilio" | "punto", sortOrder: num(f, "sortOrder"), isActive: f.get("isActive") === "on" }),
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
          <label className={field}>
            Nombre
            <input name="name" defaultValue={zone.name} maxLength={80} className={control} />
          </label>
          <label className={field}>
            Modo
            <select name="mode" defaultValue={zone.mode} className={control}>
              <option value="domicilio">{MODE_LABEL.domicilio}</option>
              <option value="punto">{MODE_LABEL.punto}</option>
            </select>
          </label>
          <OrderInput value={zone.sortOrder} label="Orden" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActiveCheck value={zone.isActive} />
          <Button type="submit" variant="secondary" disabled={pending}>
            Guardar
          </Button>
          <ConfirmButton label="Borrar" confirmLabel="Sí, borrar" disabled={pending} onConfirm={() => run(() => deleteZoneAction(zone.id), deleted)} />
          <SaveStatus status={status} />
        </div>
      </form>
    </li>
  );
}

export function ZonesEditor({ zones }: { zones: SettingsData["zones"] }) {
  const { pending, status, run } = useSave();
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {zones.map((z) => (
          <ZoneRow key={z.id} zone={z} />
        ))}
      </ul>
      <form
        ref={form}
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () => saveZoneAction({ id: null, name: String(f.get("name")), mode: f.get("mode") as "domicilio" | "punto", sortOrder: zones.length + 1, isActive: true }),
            () => {
              form.current?.reset();
              return "Zona agregada";
            },
          );
        }}
      >
        <input name="name" aria-label="Nueva zona" placeholder="Nueva zona" maxLength={80} className={`${control} flex-1 basis-40`} />
        <select name="mode" aria-label="Modo de la nueva zona" defaultValue="domicilio" className={`${control} w-auto`}>
          <option value="domicilio">{MODE_LABEL.domicilio}</option>
          <option value="punto">{MODE_LABEL.punto}</option>
        </select>
        <Button type="submit" disabled={pending}>
          Agregar zona
        </Button>
        <SaveStatus status={status} />
      </form>
    </div>
  );
}

// Puntos de encuentro ------------------------------------------------------------------------------------

function PointRow({ point }: { point: SettingsData["points"][number] }) {
  const { pending, status, run } = useSave();
  return (
    <li>
      <form
        className={row}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() =>
            savePointAction({ id: point.id, name: String(f.get("name")), reference: String(f.get("reference") ?? ""), sortOrder: num(f, "sortOrder"), isActive: f.get("isActive") === "on" }),
          );
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className={field}>
            Nombre
            <input name="name" defaultValue={point.name} maxLength={80} className={control} />
          </label>
          <label className={field}>
            Referencia
            <input name="reference" defaultValue={point.reference ?? ""} maxLength={160} className={control} />
          </label>
          <OrderInput value={point.sortOrder} label="Orden" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ActiveCheck value={point.isActive} />
          <Button type="submit" variant="secondary" disabled={pending}>
            Guardar
          </Button>
          <ConfirmButton label="Borrar" confirmLabel="Sí, borrar" disabled={pending} onConfirm={() => run(() => deletePointAction(point.id), deleted)} />
          <SaveStatus status={status} />
        </div>
      </form>
    </li>
  );
}

export function PointsEditor({ points }: { points: SettingsData["points"] }) {
  const { pending, status, run } = useSave();
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {points.map((p) => (
          <PointRow key={p.id} point={p} />
        ))}
      </ul>
      <form
        ref={form}
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () => savePointAction({ id: null, name: String(f.get("name")), reference: String(f.get("reference") ?? ""), sortOrder: points.length + 1, isActive: true }),
            () => {
              form.current?.reset();
              return "Punto agregado";
            },
          );
        }}
      >
        <input name="name" aria-label="Nuevo punto de encuentro" placeholder="Nuevo punto de encuentro" maxLength={80} className={`${control} flex-1 basis-40`} />
        <input name="reference" aria-label="Referencia del nuevo punto" placeholder="Referencia (opcional)" maxLength={160} className={`${control} flex-1 basis-40`} />
        <Button type="submit" disabled={pending}>
          Agregar punto
        </Button>
        <SaveStatus status={status} />
      </form>
    </div>
  );
}

// Categorías ------------------------------------------------------------------------------------------------

function CategoryRow({ category }: { category: SettingsData["categories"][number] }) {
  const { pending, status, run } = useSave();
  return (
    <li>
      <form
        className={row}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(() => saveCategoryAction({ id: category.id, name: String(f.get("name")), sortOrder: num(f, "sortOrder") }));
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className={field}>
            Nombre
            <input name="name" defaultValue={category.name} maxLength={80} className={control} />
          </label>
          <OrderInput value={category.sortOrder} label="Orden" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">{category.productCount === 1 ? "1 producto" : `${category.productCount} productos`}</span>
          <Button type="submit" variant="secondary" disabled={pending}>
            Guardar
          </Button>
          <ConfirmButton label="Borrar" confirmLabel="Sí, borrar" disabled={pending} onConfirm={() => run(() => deleteCategoryAction(category.id), () => "Borrada")} />
          <SaveStatus status={status} />
        </div>
      </form>
    </li>
  );
}

export function CategoriesEditor({ categories }: { categories: SettingsData["categories"] }) {
  const { pending, status, run } = useSave();
  const form = useRef<HTMLFormElement>(null);
  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </ul>
      <form
        ref={form}
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () => saveCategoryAction({ id: null, name: String(f.get("name")), sortOrder: categories.length + 1 }),
            () => {
              form.current?.reset();
              return "Categoría agregada";
            },
          );
        }}
      >
        <input name="name" aria-label="Nueva categoría" placeholder="Nueva categoría" maxLength={80} className={`${control} flex-1 basis-40`} />
        <Button type="submit" disabled={pending}>
          Agregar categoría
        </Button>
        <SaveStatus status={status} />
      </form>
    </div>
  );
}
