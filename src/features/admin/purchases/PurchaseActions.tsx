"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { callAction } from "../call-action";
import { ConfirmButton } from "../ConfirmButton";
import { control, field } from "../settings/shared";
import { centsToBsText } from "../product-schema";
import { formatMoney, type Currency } from "./money";
import {
  applyCreditAction,
  correctArrivalAction,
  receivePurchaseAction,
  recordPaymentAction,
  savePurchaseNotesAction,
  voidPaymentAction,
  voidPurchaseAction,
} from "./purchase-actions";
import type { PurchaseDetail } from "./queries";

type Status = { ok: boolean; text: string } | null;

function StatusLine({ status }: { status: Status }) {
  if (!status) return null;
  return (
    <p role={status.ok ? "status" : "alert"} className={status.ok ? "text-sm font-medium text-verde" : "text-sm font-medium text-rojo"}>
      {status.text}
    </p>
  );
}

const rateText = (rate: number | null) => (rate === null ? "" : String(rate).replace(".", ","));

/** "Llegó" (o "Corregir llegada"): cantidades que llegaron, encomienda, dólar y, al llegar, el saldo. */
function ArrivalDialog({ purchase, mode, open, onOpenChange }: { purchase: PurchaseDetail; mode: "llegada" | "correccion"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [payNow, setPayNow] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const usd = purchase.currency === "USD";
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(purchase.items.map((i) => [i.id, String(mode === "llegada" ? i.quantityOrdered : (i.quantityReceived ?? 0))])),
  );
  const [balanceEdited, setBalanceEdited] = useState<string | null>(null);
  // Lo que falta pagar según lo que LLEGÓ (no lo encargado): Σ cantidad × precio − ya pagado.
  const arrivedTotal = purchase.items.reduce((sum, i) => sum + (Number(quantities[i.id]) || 0) * i.unitPriceCents, 0);
  const balanceText = balanceEdited ?? centsToBsText(Math.max(0, arrivedTotal - purchase.paidCents));

  function submit(f: FormData) {
    const arrival = {
      currency: purchase.currency,
      received: purchase.items.map((i) => ({ itemId: i.id, quantity: String(f.get(`q-${i.id}`) ?? "") })),
      shipping: String(f.get("shipping") ?? ""),
      rate: String(f.get("rate") ?? ""),
    };
    const payment =
      mode === "llegada" && payNow
        ? {
            requestId,
            payment: {
              purchaseCurrency: purchase.currency,
              paidOn: new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" }),
              currency: purchase.currency,
              amount: String(f.get("balance") ?? ""),
              rate: arrival.rate,
              note: "Saldo al llegar",
              kind: "pago" as const,
            },
          }
        : null;
    startTransition(async () => {
      const result = await callAction(() => (mode === "llegada" ? receivePurchaseAction(purchase.id, arrival, payment) : correctArrivalAction(purchase.id, arrival)));
      if ("error" in result) return setError(result.error);
      setError(null);
      onOpenChange(false);
      const warning = "warning" in result ? (result.warning as string | undefined) : undefined;
      router.replace(`/panel/compras/${purchase.id}${warning ? `?aviso=${encodeURIComponent(warning)}` : ""}`);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || setError(null), onOpenChange(o))}>
      <DialogContent>
        <DialogTitle>{mode === "llegada" ? "Llegó la compra" : "Corregir llegada"}</DialogTitle>
        <DialogDescription>
          {mode === "llegada" ? "Anota cuántas unidades llegaron de cada producto: recién ahora sube el stock." : "Cambia lo que se anotó mal; el stock se ajusta solo."}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          {purchase.items.map((i) => (
            <label key={i.id} className={field}>
              {`Llegaron de «${i.productName}»`}
              <input
                name={`q-${i.id}`}
                type="number"
                inputMode="numeric"
                min={0}
                value={quantities[i.id] ?? ""}
                onChange={(e) => setQuantities((q) => ({ ...q, [i.id]: e.target.value }))}
                className={control}
              />
              <span className="text-xs font-normal text-muted-foreground">Encargaste {i.quantityOrdered}</span>
            </label>
          ))}
          <label className={field}>
            Costo de la encomienda (Bs)
            <input name="shipping" inputMode="decimal" defaultValue={mode === "correccion" ? centsToBsText(purchase.shippingCents) : ""} placeholder="0" className={control} />
          </label>
          {usd && (
            <label className={field}>
              A cuánto estaba el dólar
              <input name="rate" inputMode="decimal" defaultValue={rateText(purchase.arrivalRate)} placeholder="6,96" className={control} />
            </label>
          )}
          {mode === "llegada" && purchase.debtCents > 0 && (
            <div className="grid gap-2 rounded-xl bg-crema-2/60 p-3">
              <label className="flex min-h-11 items-center gap-2 font-semibold">
                <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} className="size-5 accent-verde" />
                Pagar el saldo ahora
              </label>
              {payNow && (
                <label className={field}>
                  Monto del saldo
                  <input name="balance" inputMode="decimal" value={balanceText} onChange={(e) => setBalanceEdited(e.target.value)} className={control} />
                  <span className="text-xs font-normal text-muted-foreground">En {usd ? "dólares, con el dólar de arriba" : "bolivianos"}. Si llegó menos, paga menos.</span>
                </label>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-rojo">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : mode === "llegada" ? "Guardar llegada" : "Guardar corrección"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Pago (o devolución del proveedor), en Bs o dólares con el dólar de ese día. */
function PaymentDialog({ purchase, kind, open, onOpenChange }: { purchase: PurchaseDetail; kind: "pago" | "devolucion"; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>(purchase.currency);
  // Se renueva al terminar: un reintento tras una respuesta perdida usa el mismo id (la base no duplica).
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const needsRate = currency === "USD" || purchase.currency === "USD";
  const title = kind === "pago" ? "Registrar pago" : "El proveedor me devolvió";

  function submit(f: FormData) {
    const input = {
      purchaseCurrency: purchase.currency,
      paidOn: String(f.get("paidOn") ?? ""),
      currency,
      amount: String(f.get("amount") ?? ""),
      rate: String(f.get("rate") ?? ""),
      note: String(f.get("note") ?? ""),
      kind,
    };
    startTransition(async () => {
      const result = await callAction(() => recordPaymentAction(requestId, purchase.id, input));
      if ("error" in result) return setError(result.error);
      setError(null);
      setRequestId(crypto.randomUUID());
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o || setError(null), onOpenChange(o))}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {purchase.debtCents > 0 ? `Se debe ${formatMoney(purchase.debtCents, purchase.currency)}.` : `Saldo a favor: ${formatMoney(-purchase.debtCents, purchase.currency)}.`}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(new FormData(e.currentTarget));
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className={field}>
              Monto
              <input name="amount" inputMode="decimal" defaultValue={kind === "devolucion" ? centsToBsText(Math.max(0, -purchase.debtCents)) : ""} className={control} />
            </label>
            <div className={field}>
              <label htmlFor={`pay-cur-${kind}`}>Moneda del pago</label>
              <select id={`pay-cur-${kind}`} value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={control}>
                <option value="BOB">Bolivianos</option>
                <option value="USD">Dólares</option>
              </select>
            </div>
          </div>
          {needsRate && (
            <label className={field}>
              A cuánto estaba el dólar ese día
              <input name="rate" inputMode="decimal" placeholder="6,96" className={control} />
            </label>
          )}
          <label className={field}>
            Fecha
            <input name="paidOn" type="date" defaultValue={new Date().toLocaleDateString("en-CA", { timeZone: "America/La_Paz" })} className={control} />
          </label>
          <label className={field}>
            Nota (opcional)
            <input name="note" maxLength={300} className={control} />
          </label>
          {error && (
            <p role="alert" className="text-sm font-medium text-rojo">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Guardando…" : "Guardar pago"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreditDialog({ purchase, open, onOpenChange }: { purchase: PurchaseDetail; open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState(purchase.creditTargets[0]?.id ?? "");
  // Se renueva al terminar: sin recargar, un segundo traspaso no debe reusar el id del primero.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const targetCurrency = purchase.creditTargets.find((t) => t.id === target)?.currency;
  const needsRate = targetCurrency !== undefined && targetCurrency !== purchase.currency;
  return (
    <Dialog open={open} onOpenChange={(o) => (o || setError(null), onOpenChange(o))}>
      <DialogContent>
        <DialogTitle>Usar el saldo en otra compra</DialogTitle>
        <DialogDescription>Pasa el saldo a favor como pago de otra compra a {purchase.supplier.name}.</DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const rate = String(new FormData(e.currentTarget).get("rate") ?? "");
            startTransition(async () => {
              const result = await callAction(() => applyCreditAction(requestId, purchase.id, target, rate));
              if ("error" in result) return setError(result.error);
              setRequestId(crypto.randomUUID());
              onOpenChange(false);
              router.refresh();
            });
          }}
        >
          <div className={field}>
            <label htmlFor="credit-target">Compra destino</label>
            <select id="credit-target" value={target} onChange={(e) => setTarget(e.target.value)} className={control}>
              {purchase.creditTargets.map((t) => (
                <option key={t.id} value={t.id}>
                  {`${t.orderedOn} · debe ${formatMoney(t.debtCents, t.currency)}`}
                </option>
              ))}
            </select>
          </div>
          {needsRate && (
            <label className={field}>
              A cuánto estaba el dólar
              <input name="rate" inputMode="decimal" placeholder="6,96" className={control} />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-rojo">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending || !target}>
            {pending ? "Guardando…" : "Usar saldo"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Botones de una compra según su estado. `openArrival`: viene de "Llegó" en la portada de Compras. */
export function PurchaseActions({ purchase, openArrival = false }: { purchase: PurchaseDetail; openArrival?: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"llegada" | "correccion" | "pago" | "devolucion" | "saldo" | null>(openArrival && purchase.status === "encargada" ? "llegada" : null);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  const close = (o: boolean) => !o && setDialog(null);
  if (purchase.status === "anulada") return null;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {purchase.status === "encargada" && (
          <Button size="lg" onClick={() => setDialog("llegada")}>
            Llegó
          </Button>
        )}
        {purchase.status === "recibida" && (
          <Button size="lg" variant="outline" onClick={() => setDialog("correccion")}>
            Corregir llegada
          </Button>
        )}
        <Button size="lg" variant="secondary" onClick={() => setDialog("pago")}>
          Registrar pago
        </Button>
        {purchase.debtCents < 0 && (
          <>
            {purchase.creditTargets.length > 0 && (
              <Button size="lg" variant="secondary" onClick={() => setDialog("saldo")}>
                Usar en otra compra
              </Button>
            )}
            <Button size="lg" variant="secondary" onClick={() => setDialog("devolucion")}>
              El proveedor me devolvió
            </Button>
          </>
        )}
        <ConfirmButton
          label="Anular compra"
          confirmLabel="Sí, anular"
          question={purchase.status === "recibida" ? "¿Anular? Se resta del stock lo que sumó." : "¿Anular esta compra?"}
          disabled={pending}
          onConfirm={() =>
            startTransition(async () => {
              const result = await callAction(() => voidPurchaseAction(purchase.id));
              if ("error" in result) return setStatus({ ok: false, text: result.error });
              router.refresh();
            })
          }
        />
      </div>
      <StatusLine status={status} />
      <ArrivalDialog purchase={purchase} mode="llegada" open={dialog === "llegada"} onOpenChange={close} />
      <ArrivalDialog purchase={purchase} mode="correccion" open={dialog === "correccion"} onOpenChange={close} />
      <PaymentDialog purchase={purchase} kind="pago" open={dialog === "pago"} onOpenChange={close} />
      <PaymentDialog purchase={purchase} kind="devolucion" open={dialog === "devolucion"} onOpenChange={close} />
      {purchase.creditTargets.length > 0 && <CreditDialog purchase={purchase} open={dialog === "saldo"} onOpenChange={close} />}
    </div>
  );
}

export function VoidPaymentButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <ConfirmButton
        label="Anular"
        confirmLabel="Sí, anular"
        question="¿Anular este pago?"
        disabled={pending}
        onConfirm={() =>
          startTransition(async () => {
            const result = await callAction(() => voidPaymentAction(paymentId));
            if ("error" in result) return setError(result.error);
            router.refresh();
          })
        }
      />
      {error && (
        <span role="alert" className="text-sm text-rojo">
          {error}
        </span>
      )}
    </span>
  );
}

export function PurchaseNotes({ purchase }: { purchase: PurchaseDetail }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>(null);
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        startTransition(async () => {
          const result = await callAction(() => savePurchaseNotesAction(purchase.id, String(f.get("note") ?? ""), String(f.get("issues") ?? "")));
          setStatus("error" in result ? { ok: false, text: result.error } : { ok: true, text: "Notas guardadas" });
        });
      }}
    >
      <label className={field}>
        Nota
        <textarea name="note" defaultValue={purchase.note ?? ""} maxLength={500} rows={2} className={`${control} h-auto py-2`} />
      </label>
      <label className={field}>
        Detalles por arreglar con el proveedor
        <textarea name="issues" defaultValue={purchase.issuesNote ?? ""} maxLength={1000} rows={2} className={`${control} h-auto py-2`} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="secondary" disabled={pending}>
          Guardar notas
        </Button>
        <StatusLine status={status} />
      </div>
    </form>
  );
}
