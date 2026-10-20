"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/** Botón que borra o quita algo: el primer toque pregunta, así un toque de más en el celular no hace nada. */
export function ConfirmButton({
  label,
  confirmLabel,
  question = "¿Seguro?",
  disabled,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  question?: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <Button type="button" variant="ghost" className="text-rojo hover:bg-rojo/10" disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </Button>
    );
  }
  return (
    <span role="group" aria-label={question} className="inline-flex flex-wrap items-center gap-2 rounded-xl bg-rojo/5 px-2 py-1">
      <span className="text-sm font-medium">{question}</span>
      <Button
        type="button"
        variant="outline"
        className="border-rojo text-rojo hover:bg-rojo/10"
        disabled={disabled}
        onClick={() => {
          setAsking(false);
          onConfirm();
        }}
      >
        {confirmLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setAsking(false)}>
        No
      </Button>
    </span>
  );
}
