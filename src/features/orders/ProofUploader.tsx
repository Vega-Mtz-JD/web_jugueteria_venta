"use client";

import { ImageUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { orderStatusAction, submitProofAction } from "./actions";
import { compressProof, extensionFor, validateProofFile } from "./compress";

export function ProofUploader({
  orderId,
  userId,
  code,
  whatsappPhone,
}: {
  orderId: string;
  userId: string;
  code: string;
  whatsappPhone: string | null;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [closed, setClosed] = useState(false);

  // Libera la vista previa al salir de la página.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choose(f: File | undefined) {
    setError(null);
    if (!f) return;
    const problem = validateProofFile(f);
    if (problem) {
      setFile(null);
      setPreview(null);
      setError(problem);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function send() {
    if (!file || status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const upload = await compressProof(file);
      const path = `${userId}/${orderId}/${Date.now()}.${extensionFor(upload.type)}`;
      const { error: storageError } = await createBrowserSupabase()
        .storage.from("payment-proofs")
        .upload(path, upload, { contentType: upload.type, upsert: false });
      if (storageError) throw new Error("No pudimos subir la captura. Revisa tu conexión y vuelve a intentarlo.");
      const result = await submitProofAction(orderId, path);
      if ("error" in result) throw new Error(result.error);
      router.push(`/pedidos/${orderId}`);
    } catch (e) {
      // Si el pedido ya no acepta capturas (venció o se canceló), decirlo claro: puede que ya haya pagado.
      const current = await orderStatusAction(orderId).catch(() => null);
      if (current && current !== "esperando_pago" && current !== "rechazado") {
        setClosed(true);
      } else {
        setError(e instanceof Error ? e.message : "No pudimos enviar la captura.");
      }
      setStatus("idle");
    }
  }

  if (closed) {
    return (
      <div role="alert" className="grid gap-3 rounded-2xl bg-rojo/10 p-5">
        <p className="font-semibold text-rojo">Tu pedido venció o se canceló, así que ya no acepta capturas.</p>
        <p className="text-sm">Si ya pagaste, escríbenos con el código {code} y lo resolvemos enseguida.</p>
        {whatsappPhone && (
          <a
            href={buildWhatsAppLink(whatsappPhone, `Hola, pagué el pedido ${code} pero venció antes de subir la captura`)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 w-fit items-center rounded-lg bg-cubo-verde px-4 font-semibold text-white"
          >
            Escribir por WhatsApp
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <label className="grid cursor-pointer place-items-center gap-2 rounded-2xl border-2 border-dashed border-input bg-papel p-6 text-center hover:border-madera has-focus-visible:ring-3 has-focus-visible:ring-ring/50">
        <ImageUpIcon aria-hidden className="size-8 text-verde" />
        <span className="font-semibold">{file ? "Cambiar captura" : "Elegir la captura del pago"}</span>
        <span className="text-sm text-muted-foreground">Foto o captura de pantalla, hasta 10 MB</span>
        <input
          type="file"
          accept="image/*"
          aria-label="Captura del pago"
          className="sr-only"
          onChange={(e) => choose(e.target.files?.[0])}
        />
      </label>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:), no pasa por next/image
        <img src={preview} alt="Vista previa de la captura" className="mx-auto max-h-80 rounded-xl border border-border object-contain" />
      )}
      <p aria-live="polite" className="min-h-5 text-sm font-medium text-rojo">
        {error}
      </p>
      <Button size="lg" disabled={!file || status === "sending"} onClick={send}>
        {status === "sending" ? "Enviando tu pedido…" : "Enviar pedido"}
      </Button>
    </div>
  );
}
