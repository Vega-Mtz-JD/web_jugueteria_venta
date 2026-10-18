"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import { ProofUploader } from "./ProofUploader";
import type { PaymentMethod } from "./queries";

export function PaymentStep(props: {
  orderId: string;
  userId: string;
  code: string;
  totalCents: number;
  methods: PaymentMethod[];
  rejectionReason: string | null;
}) {
  const [selected, setSelected] = useState(0);
  const [copied, setCopied] = useState(false);
  const method = props.methods[selected];

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="grid h-fit gap-5 rounded-3xl bg-crema-2 p-5 sm:p-6">
        {props.rejectionReason && (
          <p role="status" className="rounded-xl bg-rojo/10 px-4 py-3 text-sm font-medium text-rojo">
            Rechazamos la captura anterior: {props.rejectionReason}. Sube una nueva.
          </p>
        )}
        <div>
          <p className="text-sm text-muted-foreground">Total a pagar</p>
          <p className="font-serif text-4xl font-extrabold tabular-nums">{formatBs(props.totalCents)}</p>
        </div>
        <div className="rounded-2xl bg-papel p-4">
          <p className="text-sm font-medium">Escribe este código en la glosa o concepto del pago:</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span translate="no" className="font-serif text-3xl font-extrabold tracking-wide">
              {props.code}
            </span>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(props.code).then(() => setCopied(true))}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-input px-3 text-sm font-semibold hover:bg-crema-2"
            >
              {copied ? <CheckIcon aria-hidden className="size-4" /> : <CopyIcon aria-hidden className="size-4" />}
              {copied ? "Copiado" : "Copiar código"}
            </button>
          </div>
        </div>
        <div>
          <div role="tablist" aria-label="Billetera" className="flex gap-2">
            {props.methods.map((m, i) => (
              <button
                key={m.name}
                type="button"
                role="tab"
                aria-selected={i === selected}
                translate="no"
                onClick={() => setSelected(i)}
                className={cn(
                  "h-10 rounded-full border px-4 text-sm font-semibold",
                  i === selected ? "border-verde bg-verde text-crema" : "border-input bg-papel hover:border-madera",
                )}
              >
                {m.name}
              </button>
            ))}
          </div>
          {method && (
            <div role="tabpanel" className="mt-4 grid place-items-center gap-2 rounded-2xl bg-papel p-4">
              <Image
                src={method.qrUrl}
                alt={`QR de ${method.name} de la tienda`}
                width={240}
                height={280}
                unoptimized={method.qrUrl.endsWith(".svg")}
                className="h-auto w-56"
              />
              {method.accountHolder && <p className="text-sm text-muted-foreground">A nombre de {method.accountHolder}</p>}
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Escanea el QR con tu app, paga el total exacto y luego sube la captura del comprobante aquí al lado.
        </p>
      </section>

      <section>
        <h2 className="mb-4 font-serif text-xl font-bold">Sube la captura del pago</h2>
        <ProofUploader orderId={props.orderId} userId={props.userId} />
      </section>
    </div>
  );
}
