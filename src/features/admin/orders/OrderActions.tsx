"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { OrderStatus } from "@/features/orders/status";
import { compressProof, extensionFor, validateProofFile } from "@/features/orders/compress";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { setOrderStatusAction } from "../order-actions";
import { ACTION_TARGET, availableActions, type Action, type DeliveryMethod } from "../transitions";

const REJECT_SHORTCUTS = ["Monto incorrecto", "No se ve el pago", "No encontramos el pago"];

const LABEL: Record<Action, string> = {
  confirmar: "Confirmar pago",
  rechazar: "Rechazar",
  listo: "Listo para recoger",
  enviar: "Marcar como enviado",
  entregar: "Marcar como entregado",
  reembolsar: "Reembolsar",
  cancelar: "Cancelar pedido",
};

const CONFIRM: Partial<Record<Action, { question: string; yes: string }>> = {
  reembolsar: { question: "¿Reembolsar? El stock vuelve a la tienda. El dinero se devuelve por fuera de la web.", yes: "Sí, reembolsar" },
  cancelar: { question: "¿Cancelar el pedido? El stock vuelve a la tienda.", yes: "Sí, cancelar" },
};

type Extra = { rejectionReason?: string; shippingAgency?: string; trackingCode?: string; shippingProofPath?: string };

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="text-sm font-medium text-rojo">
      {error}
    </p>
  );
}

/** Botones del pedido según su estado; cada uno llama a admin_set_order_status. */
export function OrderActions({ orderId, status, method }: { orderId: string; status: OrderStatus; method: DeliveryMethod }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"rechazar" | "enviar" | null>(null);
  const [confirming, setConfirming] = useState<Action | null>(null);
  const actions = availableActions(status, method);

  function run(action: Action, extra: Extra = {}, onError = setError) {
    startTransition(async () => {
      const result = await setOrderStatusAction({ orderId, expectedFrom: status, to: ACTION_TARGET[action], ...extra });
      if ("error" in result) {
        onError(result.error);
        return;
      }
      setError(null);
      setDialog(null);
      setConfirming(null);
      router.refresh();
    });
  }

  function press(action: Action) {
    setError(null);
    if (action === "rechazar" || (action === "enviar" && method === "encomienda")) setDialog(action);
    else if (CONFIRM[action]) setConfirming(action);
    else run(action);
  }

  if (actions.length === 0) return null;
  const confirm = confirming ? CONFIRM[confirming] : undefined;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-3">
        {actions.map((a) => {
          const undo = a === "reembolsar" || a === "cancelar" || a === "rechazar";
          return (
            <Button
              key={a}
              size="lg"
              variant={undo ? "outline" : "default"}
              className={undo ? "border-rojo text-rojo hover:bg-rojo/10" : undefined}
              disabled={pending}
              onClick={() => press(a)}
            >
              {LABEL[a]}
            </Button>
          );
        })}
      </div>

      {confirming && confirm && (
        <div role="group" aria-label="Confirmar" className="grid gap-2 rounded-xl bg-rojo/5 p-3">
          <p className="text-sm font-medium">{confirm.question}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-rojo text-rojo hover:bg-rojo/10" disabled={pending} onClick={() => run(confirming)}>
              {pending ? "Guardando…" : confirm.yes}
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setConfirming(null)}>
              No
            </Button>
          </div>
        </div>
      )}
      {!dialog && <ErrorText error={error} />}

      <RejectDialog
        open={dialog === "rechazar"}
        onOpenChange={(o) => setDialog(o ? "rechazar" : null)}
        pending={pending}
        error={error}
        onSubmit={(reason) => run("rechazar", { rejectionReason: reason })}
      />
      <ShipDialog
        open={dialog === "enviar"}
        onOpenChange={(o) => setDialog(o ? "enviar" : null)}
        orderId={orderId}
        pending={pending}
        error={error}
        onError={setError}
        onSubmit={(extra) => run("enviar", extra)}
      />
    </div>
  );
}

function RejectDialog({
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Rechazar el pago</DialogTitle>
        <DialogDescription>El comprador verá el motivo y podrá subir otra captura durante 48 horas.</DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(reason);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {REJECT_SHORTCUTS.map((s) => (
              <Button key={s} type="button" variant="secondary" aria-pressed={reason === s} onClick={() => setReason(s)}>
                {s}
              </Button>
            ))}
          </div>
          <label className="grid gap-1.5 text-sm font-semibold">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={200}
              rows={3}
              className="rounded-xl border border-input bg-background px-3 py-2 text-base font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>
          <ErrorText error={error} />
          <Button type="submit" size="lg" variant="outline" className="border-rojo text-rojo hover:bg-rojo/10" disabled={pending}>
            {pending ? "Guardando…" : "Rechazar pago"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShipDialog({
  open,
  onOpenChange,
  orderId,
  pending,
  error,
  onError,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  pending: boolean;
  error: string | null;
  onError: (error: string) => void;
  onSubmit: (extra: Extra) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function submit(form: FormData) {
    const extra: Extra = {
      shippingAgency: String(form.get("agency") ?? ""),
      trackingCode: String(form.get("tracking") ?? ""),
    };
    if (file && extra.shippingAgency?.trim() && extra.trackingCode?.trim()) {
      setUploading(true);
      try {
        const upload = await compressProof(file);
        const path = `${orderId}/${Date.now()}.${extensionFor(upload.type)}`;
        const { error: storageError } = await createBrowserSupabase()
          .storage.from("shipping-proofs")
          .upload(path, upload, { contentType: upload.type, upsert: false });
        if (storageError) throw new Error("No pudimos subir la foto. Revisa tu conexión y vuelve a intentarlo.");
        extra.shippingProofPath = path;
      } catch (e) {
        onError(e instanceof Error ? e.message : "No pudimos subir la foto.");
        return;
      } finally {
        setUploading(false);
      }
    }
    onSubmit(extra);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Marcar como enviado</DialogTitle>
        <DialogDescription>El comprador verá la agencia y el número de guía para recoger su encomienda.</DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(new FormData(e.currentTarget));
          }}
        >
          <label className="grid gap-1.5 text-sm font-semibold">
            Agencia
            <Input name="agency" maxLength={200} placeholder="Ej.: Trans Copacabana" className="h-11 text-base font-normal" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Número de guía
            <Input name="tracking" maxLength={200} className="h-11 text-base font-normal" />
          </label>
          <label className="grid gap-1.5 text-sm font-semibold">
            Foto del comprobante (opcional)
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="text-sm font-normal file:mr-3 file:h-11 file:rounded-lg file:border-0 file:bg-crema-2 file:px-4 file:font-semibold"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                const problem = f ? validateProofFile(f) : null;
                if (problem) {
                  onError(problem);
                  e.target.value = "";
                  setFile(null);
                } else setFile(f);
              }}
            />
          </label>
          <ErrorText error={error} />
          <Button type="submit" size="lg" disabled={pending || uploading}>
            {uploading ? "Subiendo foto…" : pending ? "Guardando…" : "Guardar envío"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
