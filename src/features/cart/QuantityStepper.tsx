"use client";

import { MinusIcon, PlusIcon } from "lucide-react";

export function QuantityStepper({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  const btn =
    "inline-flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-crema-2 disabled:opacity-40 disabled:hover:bg-transparent";
  return (
    <div className="inline-flex items-center rounded-xl border border-input bg-papel">
      <button type="button" aria-label="Restar uno" className={btn} disabled={value <= 1} onClick={() => onChange(value - 1)}>
        <MinusIcon aria-hidden className="size-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Cantidad"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 1)}
        className="h-10 w-12 bg-transparent text-center font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button type="button" aria-label="Sumar uno" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <PlusIcon aria-hidden className="size-4" />
      </button>
    </div>
  );
}
