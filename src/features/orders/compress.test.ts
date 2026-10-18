import { describe, expect, it } from "vitest";
import { validateProofFile } from "./compress";

describe("validateProofFile", () => {
  it("acepta imágenes", () => {
    expect(validateProofFile({ type: "image/png", size: 200_000 })).toBeNull();
    expect(validateProofFile({ type: "image/heic", size: 3_000_000 })).toBeNull();
  });
  it("rechaza lo que no es imagen", () => {
    expect(validateProofFile({ type: "application/pdf", size: 1000 })).toBe("Sube una imagen (foto o captura de pantalla)");
  });
  it("rechaza archivos de más de 10 MB", () => {
    expect(validateProofFile({ type: "image/jpeg", size: 11 * 1024 * 1024 })).toBe("La imagen pesa más de 10 MB");
  });
  it("rechaza archivos vacíos", () => {
    expect(validateProofFile({ type: "image/png", size: 0 })).toBe("El archivo está vacío");
  });
});
