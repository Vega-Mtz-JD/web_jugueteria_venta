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

const WEB_TYPES = ["image/webp", "image/jpeg", "image/png"];
const PHOTO_ERROR = "No pudimos procesar esta foto. Vuelve a tomarla o elige una en JPG.";

/**
 * Foto pública de un producto: siempre en un formato que cualquier navegador muestra.
 * Si no se puede comprimir (p. ej. HEIC que el navegador no lee), no se sube el original.
 */
export async function compressProductPhoto(file: File): Promise<File> {
  let photo: File;
  try {
    const { default: imageCompression } = await import("browser-image-compression");
    photo = await imageCompression(file, {
      maxWidthOrHeight: 1600,
      maxSizeMB: 1,
      initialQuality: 0.8,
      fileType: "image/webp",
      useWebWorker: true,
    });
  } catch {
    throw new Error(PHOTO_ERROR);
  }
  if (!WEB_TYPES.includes(photo.type)) throw new Error(PHOTO_ERROR);
  return photo;
}

export function extensionFor(type: string): string {
  return { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/heic": "heic" }[type] ?? "img";
}
