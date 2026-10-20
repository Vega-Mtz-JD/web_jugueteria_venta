"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { callAction } from "../call-action";
import { saveProductAction } from "../product-actions";
import { centsToBsText, type ProductInput } from "../product-schema";
import type { AdminProductDetail } from "../queries";

const field = "grid gap-1.5 text-sm font-semibold";
const control = "h-11 text-base font-normal";

function Field({
  label,
  name,
  error,
  hint,
  className,
  ...props
}: { label: string; name: string; error?: string; hint?: string } & React.ComponentProps<typeof Input>) {
  return (
    <label className={cn(field, className)}>
      {label}
      <Input name={name} aria-invalid={error ? true : undefined} className={control} {...props} />
      {hint && !error && <span className="text-xs font-normal text-muted-foreground">{hint}</span>}
      {error && <span className="text-sm font-medium text-rojo">{error}</span>}
    </label>
  );
}

/** Crear o editar un producto. Al crear se va a su pantalla para agregar fotos. */
export function ProductForm({ product, categories }: { product?: AdminProductDetail; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const editing = Boolean(product);
  // "Borrar" puede ocultar el producto desde fuera del formulario: seguir el valor de la base.
  const [active, setActive] = useState(product?.isActive ?? true);
  const [seenActive, setSeenActive] = useState(product?.isActive);
  if (product && product.isActive !== seenActive) {
    setSeenActive(product.isActive);
    setActive(product.isActive);
  }

  function submit(form: FormData) {
    const text = (k: string) => String(form.get(k) ?? "");
    const input: ProductInput = {
      name: text("name"),
      categoryId: text("categoryId"),
      priceBs: text("priceBs"),
      compareAtBs: text("compareAtBs"),
      minAge: text("minAge"),
      minPlayers: text("minPlayers"),
      maxPlayers: text("maxPlayers"),
      stock: editing ? undefined : text("stock"),
      description: text("description"),
      isNew: form.get("isNew") === "on",
      isActive: form.get("isActive") === "on",
    };
    startTransition(async () => {
      const result = await callAction(() => saveProductAction(product?.id ?? null, input));
      if ("error" in result) {
        setErrors("fieldErrors" in result ? result.fieldErrors : {});
        setMessage({ ok: false, text: result.error });
        return;
      }
      setErrors({});
      if (!editing) {
        router.push(`/panel/productos/${result.id}?nuevo=1`);
        return;
      }
      setMessage({ ok: true, text: "Cambios guardados" });
      router.refresh();
    });
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <Field label="Nombre" name="name" defaultValue={product?.name} maxLength={120} error={errors.name} />
      <div className={field}>
        <label htmlFor="product-category">Categoría</label>
        <select
          id="product-category"
          name="categoryId"
          defaultValue={product?.categoryId ?? ""}
          aria-invalid={errors.categoryId ? true : undefined}
          className="h-11 rounded-lg border border-input bg-background px-3 text-base font-normal"
        >
          <option value="" disabled>
            Elige una categoría
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categoryId && <span className="text-sm font-medium text-rojo">{errors.categoryId}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Precio (Bs)" name="priceBs" inputMode="decimal" defaultValue={centsToBsText(product?.priceCents ?? null)} error={errors.priceBs} />
        <Field
          label="Precio anterior (Bs)"
          name="compareAtBs"
          inputMode="decimal"
          defaultValue={centsToBsText(product?.compareAtCents ?? null)}
          hint="Opcional: marca la oferta"
          error={errors.compareAtBs}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Edad mínima" name="minAge" type="number" inputMode="numeric" defaultValue={product?.minAge ?? ""} error={errors.minAge} />
        <Field label="Jugadores mínimo" name="minPlayers" type="number" inputMode="numeric" defaultValue={product?.minPlayers ?? ""} error={errors.minPlayers} />
        <Field label="Jugadores máximo" name="maxPlayers" type="number" inputMode="numeric" defaultValue={product?.maxPlayers ?? ""} error={errors.maxPlayers} />
      </div>
      {!editing && (
        <Field
          label="Stock inicial"
          name="stock"
          type="number"
          inputMode="numeric"
          defaultValue={0}
          hint="Después se corrige con «Contar estante»"
          error={errors.stock}
          className="max-w-48"
        />
      )}
      <label className={field}>
        Descripción
        <textarea
          name="description"
          defaultValue={product?.description ?? ""}
          maxLength={2000}
          rows={5}
          className="rounded-lg border border-input bg-background px-3 py-2 text-base font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        {errors.description && <span className="text-sm font-medium text-rojo">{errors.description}</span>}
      </label>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" name="isActive" checked={active} onChange={(e) => setActive(e.target.checked)} className="size-5 accent-verde" />
          Visible en la tienda
        </label>
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" name="isNew" defaultChecked={product?.isNew ?? false} className="size-5 accent-verde" />
          Nuevo
        </label>
      </div>
      {message && (
        <p role={message.ok ? "status" : "alert"} className={cn("text-sm font-medium", message.ok ? "text-verde" : "text-rojo")}>
          {message.text}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">
        {pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}
      </Button>
    </form>
  );
}
