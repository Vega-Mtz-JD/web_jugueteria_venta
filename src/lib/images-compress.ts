const MAX_BYTES = 10 * 1024 * 1024;
const MAX_UNCOMPRESSED_UPLOAD = 5 * 1024 * 1024; // límite de los buckets de Storage

/** null si el archivo sirve como foto; si no, el motivo para mostrar. */
export function validateImageFile(file: { type: string; size: number }): string | null {
  if (file.size === 0) return "El archivo está vacío";
  if (!file.type.startsWith("image/")) return "Sube una imagen (foto o captura de pantalla)";
  if (file.size > MAX_BYTES) return "La imagen pesa más de 10 MB";
  return null;
}

/** Comprime a WebP (lado máximo 1600 px). Si no se puede y el original entra en el bucket, usa el original. */
export async function compressImage(file: File): Promise<File> {
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    return await imageCompression(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 1,
      initialQuality: 0.8,
      fileType: "image/webp",
      useWebWorker: true,
    });
  } catch {
    if (file.size <= MAX_UNCOMPRESSED_UPLOAD) return file;
    throw new Error("No pudimos procesar la imagen. Prueba con una captura de pantalla.");
  }
}

export function extensionFor(type: string): string {
  return { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic" }[type] ?? "img";
}
