"use client";

import { SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { catalogHref } from "./filters";
import type { CatalogFilters as Filters, CatalogSort } from "./types";

const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "destacados", label: "Destacados" },
  { value: "precio_asc", label: "Menor precio" },
  { value: "precio_desc", label: "Mayor precio" },
  { value: "nuevos", label: "Nuevos" },
];
const AGES = [3, 6, 8, 10, 12, 14, 18];
const PLAYERS = [1, 2, 3, 4, 5, 6, 8];

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-papel px-3 text-[0.95rem] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

function useApplyFilters(current: Filters) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const apply = (patch: Partial<Filters>) => {
    const next = { ...current, ...patch };
    startTransition(() => router.replace(catalogHref(next), { scroll: false }));
  };
  return { apply, pending };
}

function toNumber(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

/**
 * Estado local de un campo de texto ligado a la URL. Lo que la persona escribe nunca se
 * pisa con una URL que llega tarde; solo se reinicia cuando el filtro se limpia desde
 * fuera (por ejemplo, "Limpiar filtros").
 */
function useUrlField(urlValue: string) {
  const [value, setValue] = useState(urlValue);
  const [applied, setApplied] = useState(urlValue);
  const [previousUrl, setPreviousUrl] = useState(urlValue);
  // Solo cuando la URL *cambia* a vacía (no mientras aún no llega la nueva).
  if (urlValue !== previousUrl) {
    setPreviousUrl(urlValue);
    if (urlValue === "") {
      setApplied("");
      setValue("");
    }
  }
  return { value, setValue, applied, markApplied: setApplied };
}

export function CatalogSearch({ current }: { current: Filters }) {
  const { apply, pending } = useApplyFilters(current);
  const { value, setValue, applied, markApplied } = useUrlField(current.q ?? "");

  useEffect(() => {
    const term = value.trim();
    if (term === applied) return;
    const timer = setTimeout(() => {
      markApplied(term);
      apply({ q: term || undefined });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reaccionar a lo que escribe la persona
  }, [value]);

  return (
    <label className="relative block">
      <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        name="q"
        autoComplete="off"
        aria-label="Buscar juegos"
        placeholder="Buscar por nombre: Catán, UNO, ajedrez…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={cn(fieldClass, "pl-10", pending && "opacity-70")}
      />
    </label>
  );
}

function PriceInput({
  name,
  label,
  placeholder,
  urlValue,
  onApply,
}: {
  name: string;
  label: string;
  placeholder: string;
  urlValue: number | undefined;
  onApply: (value: number | undefined) => void;
}) {
  const { value, setValue, applied, markApplied } = useUrlField(urlValue === undefined ? "" : String(urlValue));
  const commit = () => {
    if (value === applied) return;
    markApplied(value);
    onApply(toNumber(value));
  };
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      name={name}
      autoComplete="off"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === "Enter" && commit()}
      className={fieldClass}
    />
  );
}

function FilterControls({ current, className }: { current: Filters; className?: string }) {
  const { apply } = useApplyFilters(current);
  return (
    <div className={cn("grid gap-4", className)}>
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="mb-1.5 text-sm font-medium">Precio (Bs)</legend>
        <PriceInput name="precio_min" label="Precio mínimo" placeholder="Desde" urlValue={current.precioMin} onApply={(v) => apply({ precioMin: v })} />
        <PriceInput name="precio_max" label="Precio máximo" placeholder="Hasta" urlValue={current.precioMax} onApply={(v) => apply({ precioMax: v })} />
      </fieldset>
      <label className="grid gap-1.5 text-sm font-medium">
        ¿Qué edad tiene quien juega?
        <select value={current.edad ?? ""} onChange={(e) => apply({ edad: toNumber(e.target.value) })} className={fieldClass}>
          <option value="">Cualquier edad</option>
          {AGES.map((age) => (
            <option key={age} value={age}>
              {age} años
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        ¿Cuántos van a jugar?
        <select
          value={current.jugadores ?? ""}
          onChange={(e) => apply({ jugadores: toNumber(e.target.value) })}
          className={fieldClass}
        >
          <option value="">Cualquier cantidad</option>
          {PLAYERS.map((n) => (
            <option key={n} value={n}>
              {n === 1 ? "1 jugador" : `${n} jugadores`}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Ordenar por
        <select
          value={current.orden}
          onChange={(e) => apply({ orden: e.target.value as CatalogSort })}
          className={fieldClass}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={current.ofertas === true}
          onChange={(e) => apply({ ofertas: e.target.checked ? true : undefined })}
          className="size-5 accent-verde"
        />
        Solo ofertas
      </label>
    </div>
  );
}

/** Filtros: en PC van en una columna lateral; en celular, en un panel que se abre con "Filtros". */
export function CatalogFilters({ current }: { current: Filters }) {
  return (
    <>
      <FilterControls current={current} className="hidden md:grid" />
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" className="md:hidden">
            <SlidersHorizontalIcon data-icon="inline-start" />
            Filtros
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto overscroll-contain rounded-t-3xl bg-crema px-5 pb-8 pt-6">
          <SheetTitle className="font-serif text-xl">Filtros</SheetTitle>
          <FilterControls current={current} />
        </SheetContent>
      </Sheet>
    </>
  );
}
