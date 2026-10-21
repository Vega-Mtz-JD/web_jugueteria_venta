"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { callAction } from "../call-action";
import { control, field } from "../settings/shared";
import type { Currency } from "./money";
import { createPurchaseAction, updatePurchaseAction } from "./purchase-actions";
import type { PurchaseInput } from "./purchase-schema";

type Option = { id: string; name: string };
type Line = { key: string; productId: string; isNew: boolean; newName: string; categoryId: string; quantity: string; unitPrice: string };

export type PurchaseFormInitial = {
  id: string;
  supplierId: string;
  orderedOn: string;
  currency: Currency;
  note: string;
  lines: { productId: string; quantity: number; unitPriceText: string }[];
};

const newLine = (): Line => ({ key: crypto.randomUUID(), productId: "", isNew: false, newName: "", categoryId: "", quantity: "1", unitPrice: "" });

/** Encargar una compra (o corregirla mientras no llegue). Las líneas se agregan de a una: cómodo en el celular. */
export function PurchaseForm({
  suppliers,
  products,
  categories,
  today,
  initial,
}: {
  suppliers: Option[];
  products: Option[];
  categories: Option[];
  today: string;
  initial?: PurchaseFormInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? "BOB");
  const [lines, setLines] = useState<Line[]>(
    initial?.lines.map((l) => ({ ...newLine(), productId: l.productId, quantity: String(l.quantity), unitPrice: l.unitPriceText })) ?? [newLine()],
  );
  const [advanceCurrency, setAdvanceCurrency] = useState<Currency>(initial?.currency ?? "BOB");
  // Un id por envío: un doble toque o una respuesta perdida no crean dos compras ni dos adelantos.
  const [requestIds] = useState(() => ({ purchase: crypto.randomUUID(), advance: crypto.randomUUID() }));

  const update = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const needsRate = currency === "USD" || advanceCurrency === "USD";

  function submit(form: FormData) {
    const input: PurchaseInput = {
      supplierId: String(form.get("supplierId") ?? ""),
      orderedOn: String(form.get("orderedOn") ?? today),
      currency,
      note: String(form.get("note") ?? ""),
      lines: lines.map((l) => ({
        ...(l.isNew ? { newProduct: { name: l.newName, categoryId: l.categoryId } } : l.productId ? { productId: l.productId } : {}),
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
    };
    const amount = String(form.get("advanceAmount") ?? "").trim();
    const advance =
      !initial && amount
        ? {
            requestId: requestIds.advance,
            payment: {
              purchaseCurrency: currency,
              paidOn: input.orderedOn,
              currency: advanceCurrency,
              amount,
              rate: String(form.get("advanceRate") ?? ""),
              note: "Adelanto",
              kind: "pago" as const,
            },
          }
        : null;
    startTransition(async () => {
      if (initial) {
        const result = await callAction(() => updatePurchaseAction(initial.id, input));
        if ("error" in result) return setError(result.error);
        router.push(`/panel/compras/${initial.id}`);
        router.refresh();
        return;
      }
      const result = await callAction(() => createPurchaseAction(requestIds.purchase, input, advance));
      if ("error" in result) return setError(result.error);
      router.push(`/panel/compras/${result.id}${result.warning ? `?aviso=${encodeURIComponent(result.warning)}` : ""}`);
    });
  }

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(new FormData(e.currentTarget));
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={field}>
          <label htmlFor="purchase-supplier">Proveedor</label>
          <select id="purchase-supplier" name="supplierId" defaultValue={initial?.supplierId ?? ""} className={control}>
            <option value="" disabled>
              Elige un proveedor
            </option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {suppliers.length === 0 && (
            <Link href="/panel/proveedores" className="text-sm font-normal text-verde underline">
              Primero agrega un proveedor
            </Link>
          )}
        </div>
        <label className={field}>
          Fecha del encargo
          <input name="orderedOn" type="date" defaultValue={initial?.orderedOn ?? today} className={control} />
        </label>
      </div>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-sm font-semibold">Moneda de la compra</legend>
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {(["BOB", "USD"] as const).map((c) => (
            <label
              key={c}
              className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 font-semibold", currency === c ? "border-verde bg-verde/10 text-verde" : "border-input")}
            >
              <input type="radio" name="currency" value={c} checked={currency === c} onChange={() => (setCurrency(c), setAdvanceCurrency(c))} className="mr-2 size-4 accent-verde" />
              {c === "BOB" ? "Bolivianos" : "Dólares"}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3">
        {lines.map((l, i) => (
          <fieldset key={l.key} aria-label={`Producto ${i + 1}`} className="grid gap-3 rounded-2xl border border-[#eadcc4] bg-papel p-3 sm:grid-cols-[1fr_7rem_9rem]">
            <div className="grid gap-2 sm:col-span-3">
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={l.isNew} onChange={(e) => update(l.key, { isNew: e.target.checked })} className="size-5 accent-verde" />
                Es un juego nuevo
              </label>
              {l.isNew ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={field}>
                    Nombre del juego nuevo
                    <input value={l.newName} onChange={(e) => update(l.key, { newName: e.target.value })} maxLength={120} className={control} />
                  </label>
                  <div className={field}>
                    <label htmlFor={`cat-${l.key}`}>Categoría del juego nuevo</label>
                    <select id={`cat-${l.key}`} value={l.categoryId} onChange={(e) => update(l.key, { categoryId: e.target.value })} className={control}>
                      <option value="" disabled>
                        Elige una categoría
                      </option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs font-normal text-muted-foreground sm:col-span-2">Se crea oculto: no aparece en la tienda hasta que le pongas precio y lo muestres.</p>
                </div>
              ) : (
                <div className={field}>
                  <label htmlFor={`prod-${l.key}`}>Producto</label>
                  <select id={`prod-${l.key}`} value={l.productId} onChange={(e) => update(l.key, { productId: e.target.value })} className={control}>
                    <option value="" disabled>
                      Elige un producto
                    </option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <label className={field}>
              Cantidad
              <input value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} type="number" inputMode="numeric" min={1} className={control} />
            </label>
            <label className={field}>
              Precio por unidad
              <input value={l.unitPrice} onChange={(e) => update(l.key, { unitPrice: e.target.value })} inputMode="decimal" placeholder={currency === "BOB" ? "Bs" : "US$"} className={control} />
            </label>
            {lines.length > 1 && (
              <Button type="button" variant="ghost" className="self-end text-rojo hover:bg-rojo/10" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                <Trash2Icon aria-hidden />
                Quitar
              </Button>
            )}
          </fieldset>
        ))}
        <Button type="button" variant="secondary" className="justify-self-start" onClick={() => setLines((ls) => [...ls, newLine()])}>
          <PlusIcon data-icon="inline-start" />
          Agregar otro producto
        </Button>
      </div>

      {!initial && (
        <fieldset aria-label="Adelanto (opcional)" className="grid gap-3 rounded-2xl border border-[#eadcc4] bg-papel p-3 sm:grid-cols-3">
          <legend className="px-1 text-sm font-semibold">Adelanto (opcional)</legend>
          <label className={field}>
            Monto del adelanto
            <input name="advanceAmount" inputMode="decimal" className={control} />
          </label>
          <div className={field}>
            <label htmlFor="advance-currency">Moneda del adelanto</label>
            <select id="advance-currency" value={advanceCurrency} onChange={(e) => setAdvanceCurrency(e.target.value as Currency)} className={control}>
              <option value="BOB">Bolivianos</option>
              <option value="USD">Dólares</option>
            </select>
          </div>
          {needsRate && (
            <label className={field}>
              A cuánto estaba el dólar
              <input name="advanceRate" inputMode="decimal" placeholder="6,96" className={control} />
            </label>
          )}
        </fieldset>
      )}

      <label className={field}>
        Nota
        <textarea name="note" defaultValue={initial?.note ?? ""} maxLength={500} rows={2} className={`${control} h-auto py-2`} />
      </label>

      {error && (
        <p role="alert" className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">
        {pending ? "Guardando…" : initial ? "Guardar cambios" : "Guardar compra"}
      </Button>
    </form>
  );
}
