export const NETWORK_ERROR = "No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.";

/**
 * Llama una Server Action desde el panel. Si se cae la señal, devuelve el aviso en vez de lanzar:
 * un error dentro de una transición de React llevaría a la pantalla de "tienda no disponible".
 */
export async function callAction<T>(action: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await action();
  } catch {
    return { error: NETWORK_ERROR };
  }
}

/** Mensaje para un error al subir una foto: los de red (TypeError de fetch) se dicen en español. */
export function uploadErrorMessage(e: unknown): string {
  if (e instanceof Error && !(e instanceof TypeError)) return e.message;
  return NETWORK_ERROR;
}
