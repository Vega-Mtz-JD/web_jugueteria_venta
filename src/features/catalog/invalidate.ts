import { revalidateTag, updateTag } from "next/cache";
import { after } from "next/server";
import { CATALOG_TAG } from "./cached";

/** Tiempo de sobra para que termine una regeneración de página que ya estaba en curso. */
export const LATE_INVALIDATION_MS = 3000;

/**
 * Para Server Actions que cambian datos públicos (productos, ajustes, stock).
 * updateTag hace que la próxima visita traiga lo nuevo, pero una regeneración de la página que
 * empezó antes del cambio (p. ej. la portada servida vieja al ingresar) puede terminar después
 * y volver a guardar los datos viejos. Por eso se invalida otra vez cuando eso ya terminó.
 */
export function invalidateCatalog(): void {
  updateTag(CATALOG_TAG);
  // Defensa sin probar del todo (ver el registro del plan 4): si algún día sobra, se puede quitar.
  try {
    after(async () => {
      await new Promise((resolve) => setTimeout(resolve, LATE_INVALIDATION_MS));
      revalidateTag(CATALOG_TAG, { expire: 0 });
    });
  } catch {
    // La plataforma no permite after() (sin waitUntil): el guardado ya invalidó al momento.
  }
}
