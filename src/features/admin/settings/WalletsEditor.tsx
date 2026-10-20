"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compressImage, extensionFor, validateImageFile } from "@/lib/images-compress";
import { createBrowserSupabase } from "@/lib/supabase/client";
import type { SettingsData } from "../queries";
import { deleteWalletAction, saveWalletAction } from "../settings-actions";
import { control, field, SaveStatus, useSave } from "./shared";

type Wallet = SettingsData["wallets"][number];

/** Sube el QR al bucket store-assets y devuelve su ruta (qr/<uuid>.<ext>). */
async function uploadQr(file: File): Promise<string> {
  const problem = validateImageFile(file);
  if (problem) throw new Error(problem);
  const image = await compressImage(file);
  const path = `qr/${crypto.randomUUID()}.${extensionFor(image.type)}`;
  const { error } = await createBrowserSupabase().storage.from("store-assets").upload(path, image, { contentType: image.type, upsert: false });
  if (error) throw new Error("No pudimos subir el QR. Revisa tu conexión y vuelve a intentarlo.");
  return path;
}

function values(f: FormData) {
  return {
    name: String(f.get("name") ?? ""),
    accountHolder: String(f.get("accountHolder") ?? ""),
    sortOrder: Number(f.get("sortOrder") ?? 0) || 0,
    isActive: f.get("isActive") === "on",
  };
}

function WalletRow({ wallet }: { wallet: Wallet }) {
  const { pending, status, setStatus, run } = useSave();
  const form = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);

  async function changeQr(file: File) {
    setUploading(true);
    try {
      const qrPath = await uploadQr(file);
      const f = new FormData(form.current ?? undefined);
      run(() => saveWalletAction({ id: wallet.id, ...values(f), qrPath }));
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "No pudimos subir el QR." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <li>
      <form
        ref={form}
        className="grid gap-3 rounded-2xl border border-[#eadcc4] bg-background/40 p-3 sm:grid-cols-[8rem_1fr]"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveWalletAction({ id: wallet.id, ...values(new FormData(e.currentTarget)) }));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- QR de ejemplo (SVG) o subido al bucket */}
        <img src={wallet.qrUrl} alt={`QR actual de ${wallet.name}`} className="aspect-square w-32 rounded-xl border border-border bg-white object-contain p-1" />
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <label className={field}>
              Nombre
              <input name="name" defaultValue={wallet.name} maxLength={80} className={control} />
            </label>
            <label className={field}>
              Titular
              <input name="accountHolder" defaultValue={wallet.accountHolder ?? ""} maxLength={120} className={control} />
            </label>
            <label className={field}>
              Orden
              <input name="sortOrder" type="number" min={0} max={999} defaultValue={wallet.sortOrder} className={`${control} w-24`} />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-madera px-4 text-[0.95rem] font-semibold text-madera hover:bg-madera/10 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50">
              {uploading ? "Subiendo…" : "Cambiar QR"}
              <input
                type="file"
                accept="image/*"
                aria-label={`Cambiar QR de ${wallet.name}`}
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void changeQr(file);
                }}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 font-semibold">
              <input name="isActive" type="checkbox" defaultChecked={wallet.isActive} className="size-5 accent-verde" />
              Activa
            </label>
            <Button type="submit" variant="secondary" disabled={pending || uploading}>
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-rojo hover:bg-rojo/10"
              disabled={pending || uploading}
              onClick={() => run(() => deleteWalletAction(wallet.id), () => "Borrada")}
            >
              Borrar
            </Button>
            <SaveStatus status={status} />
          </div>
        </div>
      </form>
    </li>
  );
}

export function WalletsEditor({ wallets }: { wallets: Wallet[] }) {
  const { pending, status, setStatus, run } = useSave();
  const form = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);

  async function add(f: FormData) {
    const file = f.get("qr");
    if (!(file instanceof File) || file.size === 0) return setStatus({ ok: false, text: "Sube la imagen del QR" });
    setUploading(true);
    try {
      const qrPath = await uploadQr(file);
      run(
        () => saveWalletAction({ id: null, ...values(f), sortOrder: wallets.length + 1, isActive: true, qrPath }),
        () => {
          form.current?.reset();
          return "Billetera agregada";
        },
      );
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "No pudimos subir el QR." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <ul className="grid gap-3">
        {wallets.map((w) => (
          <WalletRow key={w.id} wallet={w} />
        ))}
      </ul>
      <form
        ref={form}
        className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void add(new FormData(e.currentTarget));
        }}
      >
        <input name="name" aria-label="Nueva billetera" placeholder="Nueva billetera (p. ej. Tigo Money)" maxLength={80} className={control} />
        <input name="accountHolder" aria-label="Titular de la nueva billetera" placeholder="Titular (opcional)" maxLength={120} className={control} />
        <label className="inline-flex h-11 cursor-pointer items-center rounded-lg border border-input px-3 text-sm font-semibold">
          Imagen del QR
          <input name="qr" type="file" accept="image/*" className="ml-2 w-28 text-xs font-normal" />
        </label>
        <Button type="submit" disabled={pending || uploading}>
          {uploading ? "Subiendo…" : "Agregar billetera"}
        </Button>
        <div className="sm:col-span-4">
          <SaveStatus status={status} />
        </div>
      </form>
    </div>
  );
}
