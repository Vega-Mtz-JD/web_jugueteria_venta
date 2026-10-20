"use client";

import { CameraIcon, ImagesIcon, StarIcon, Trash2Icon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { compressProductPhoto, extensionFor, validateImageFile } from "@/lib/images-compress";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { callAction, NETWORK_ERROR, uploadErrorMessage } from "../call-action";
import { addProductPhotoAction, makeMainPhotoAction, removeProductPhotoAction } from "../product-actions";

const MAX_PHOTOS = 5;
const pickerClass =
  "inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border border-madera px-4 text-[0.95rem] font-semibold text-madera hover:bg-madera/10 has-[input:focus-visible]:ring-3 has-[input:focus-visible]:ring-ring/50";

/** Fotos del producto: hasta 5, desde la cámara o la galería; la primera es la principal. */
export function PhotoManager({ productId, productName, images }: { productId: string; productName: string; images: { id: string; url: string }[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const full = images.length >= MAX_PHOTOS;

  async function upload(files: File[]) {
    setError(null);
    const room = MAX_PHOTOS - images.length;
    if (files.length > room) {
      setError(`Cada producto puede tener hasta ${MAX_PHOTOS} fotos`);
      files = files.slice(0, room);
    }
    for (const file of files) {
      const problem = validateImageFile(file);
      if (problem) {
        setError(problem);
        continue;
      }
      try {
        setStatus("Subiendo foto…");
        const photo = await compressProductPhoto(file);
        const path = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionFor(photo.type)}`;
        const { error: storageError } = await createBrowserSupabase()
          .storage.from("product-images")
          .upload(path, photo, { contentType: photo.type, upsert: false });
        if (storageError) throw new Error(NETWORK_ERROR);
        const result = await callAction(() => addProductPhotoAction(productId, path));
        if ("error" in result) throw new Error(result.error);
      } catch (e) {
        setError(uploadErrorMessage(e));
      }
    }
    setStatus(null);
    router.refresh();
  }

  function act(action: () => Promise<{ ok: true } | { error: string }>) {
    startTransition(async () => {
      const result = await callAction(action);
      if ("error" in result) setError(result.error);
      else {
        setError(null);
        router.refresh();
      }
    });
  }

  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length) void upload(files);
  };

  return (
    <div className="grid gap-4">
      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((img, i) => (
            <li key={img.id} className="grid gap-2 rounded-2xl bg-papel p-2">
              <div className="relative aspect-square overflow-hidden rounded-xl bg-crema-2">
                <Image src={img.url} alt={`Foto ${i + 1}`} fill sizes="200px" unoptimized={img.url.endsWith(".svg")} className="object-contain" />
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-verde px-2 py-0.5 text-xs font-bold text-crema">Principal</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {i > 0 && (
                  <Button variant="ghost" size="sm" className="h-10" disabled={pending} onClick={() => act(() => makeMainPhotoAction(img.id))}>
                    <StarIcon aria-hidden />
                    Hacer principal
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 text-rojo hover:bg-rojo/10"
                  aria-label={`Quitar foto ${i + 1}`}
                  disabled={pending}
                  onClick={() => act(() => removeProductPhotoAction(img.id))}
                >
                  <Trash2Icon aria-hidden />
                  Quitar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">«{productName}» todavía no tiene fotos. En la tienda se verá una imagen de relleno.</p>
      )}

      {!full && (
        <div className="flex flex-wrap gap-2">
          <label className={pickerClass}>
            <CameraIcon aria-hidden className="size-5" />
            Tomar foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFiles} disabled={status !== null} />
          </label>
          <label className={pickerClass}>
            <ImagesIcon aria-hidden className="size-5" />
            Elegir de la galería
            <input type="file" accept="image/*" multiple className="sr-only" onChange={onFiles} disabled={status !== null} />
          </label>
        </div>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {status ?? `${images.length} de ${MAX_PHOTOS} fotos`}
      </p>
      {error && (
        <p role="alert" className="text-sm font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
