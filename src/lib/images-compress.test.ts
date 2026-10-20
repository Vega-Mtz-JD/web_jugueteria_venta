import { beforeEach, describe, expect, it, vi } from "vitest";

const compress = vi.fn();
vi.mock("browser-image-compression", () => ({ default: (...args: unknown[]) => compress(...args) }));

const { compressImage, compressProductPhoto } = await import("./images-compress");

const heic = () => new File([new Uint8Array(1000)], "foto.heic", { type: "image/heic" });

describe("compressProductPhoto", () => {
  beforeEach(() => {
    compress.mockReset();
  });

  it("devuelve la versión WebP cuando se puede comprimir", async () => {
    compress.mockResolvedValue(new File([new Uint8Array(10)], "foto.webp", { type: "image/webp" }));
    expect((await compressProductPhoto(heic())).type).toBe("image/webp");
  });

  it("si el navegador no puede leer la foto (HEIC), no sube el original: los compradores no la verían", async () => {
    compress.mockImplementation(() => {
      throw new Error("no se pudo decodificar");
    });
    await expect(compressProductPhoto(heic())).rejects.toThrow("No pudimos procesar esta foto");
    // Las capturas de pago sí pueden subir el original (solo las ve el dueño).
    expect((await compressImage(heic())).type).toBe("image/heic");
  });

  it("rechaza un resultado que no es JPG, PNG ni WebP", async () => {
    compress.mockResolvedValue(heic());
    await expect(compressProductPhoto(heic())).rejects.toThrow("No pudimos procesar esta foto");
  });
});
