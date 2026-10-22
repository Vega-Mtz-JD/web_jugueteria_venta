"use client";

import { ArrowDownIcon, ArrowUpIcon, CameraIcon } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { compressProductPhoto, extensionFor, validateImageFile } from "@/lib/images-compress";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { NETWORK_ERROR, uploadErrorMessage } from "../call-action";
import { ConfirmButton } from "../ConfirmButton";
import { addStorePhotoAction, moveStorePhotoAction, removeStorePhotoAction, updateStorePhotoCaptionAction } from "../store-photo-actions";
import { control, field, SaveStatus, useSave } from "./shared";

const MAX_PHOTOS = 8;
const pickerClass =
  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-madera px-4 text-[0.95rem] font-semibold text-madera hover:bg-madera/10 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50";

type Photo = { id: string; url: string; caption: string };

/** Fotos del local y de La Paz para la postal de la portada: hasta 8, cada una con su frase. */
export function StorePhotosEditor({ photos }: { photos: Photo[] }) {
  const { pending, status, run } = useSave();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const full = photos.length >= MAX_PHOTOS;
  const busy = pending || uploading;

  async function upload(file: File | null, text: string) {
    setUploadError(null);
    if (!file) return setUploadError("Elige una foto");
    if (!text.trim()) return setUploadError("Escribe una frase corta");
    const problem = validateImageFile(file);
    if (problem) return setUploadError(problem);
    setUploading(true);
    try {
      const photo = await compressProductPhoto(file);
      const path = `tienda/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(photo.type)}`;
      const { error } = await createBrowserSupabase().storage.from("product-images").upload(path, photo, { contentType: photo.type, upsert: false });
      if (error) throw new Error(NETWORK_ERROR);
      run(
        () => addStorePhotoAction(path, text),
        () => {
          form.current?.reset();
          setFileName(null);
          return "Foto subida";
        },
      );
    } catch (e) {
      setUploadError(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-5">
      {full ? (
        <p className="font-medium text-madera">La tienda puede tener hasta 8 fotos. Quita una para subir otra.</p>
      ) : (
        <form
          ref={form}
          className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const file = f.get("photo");
            void upload(file instanceof File && file.size > 0 ? file : null, String(f.get("caption") ?? ""));
          }}
        >
          <label className={pickerClass}>
            <CameraIcon aria-hidden className="size-4" />
            {fileName ?? "Elegir foto"}
            <input
              name="photo"
              type="file"
              accept="image/*"
              aria-label="Elegir foto"
              className="sr-only"
              onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? null)}
            />
          </label>
          <label className={field}>
            Frase
            <input name="caption" maxLength={80} placeholder="Nuestra vitrina" className={control} />
          </label>
          <Button type="submit" disabled={busy}>
            {uploading ? "Subiendo…" : "Subir foto"}
          </Button>
        </form>
      )}
      {uploadError && (
        <p role="alert" className="text-sm font-medium text-rojo">
          {uploadError}
        </p>
      )}
      <SaveStatus status={status} />

      {photos.length === 0 ? (
        <p className="text-muted-foreground">Todavía no hay fotos.</p>
      ) : (
        <ol aria-label="Fotos subidas" className="grid grid-cols-[minmax(0,1fr)] gap-3">
          {photos.map((p, i) => (
            <li key={p.id} className="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-2xl bg-background/50 p-3">
              <Image src={p.url} alt="" width={80} height={60} className="aspect-[4/3] h-auto w-20 rounded-lg object-cover" />
              <div className="grid gap-2">
                <form
                  className="flex flex-wrap gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = String(new FormData(e.currentTarget).get("caption") ?? "");
                    run(() => updateStorePhotoCaptionAction(p.id, text));
                  }}
                >
                  <input name="caption" defaultValue={p.caption} maxLength={80} aria-label={`Frase de «${p.caption}»`} className={`${control} flex-1`} />
                  <Button type="submit" variant="outline" disabled={busy}>
                    Guardar
                  </Button>
                </form>
                <div className="flex flex-wrap items-center gap-1">
                  <Button type="button" variant="ghost" size="icon" aria-label={`Mover arriba: ${p.caption}`} disabled={busy || i === 0} onClick={() => run(() => moveStorePhotoAction(p.id, "up"))}>
                    <ArrowUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Mover abajo: ${p.caption}`}
                    disabled={busy || i === photos.length - 1}
                    onClick={() => run(() => moveStorePhotoAction(p.id, "down"))}
                  >
                    <ArrowDownIcon aria-hidden />
                  </Button>
                  <ConfirmButton label="Quitar" confirmLabel="Sí, quitar" question="¿Quitar esta foto de la portada?" disabled={busy} onConfirm={() => run(() => removeStorePhotoAction(p.id), () => "Quitada")} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
