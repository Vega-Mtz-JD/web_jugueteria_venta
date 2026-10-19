import { describe, expect, it } from "vitest";
import { customerCanCancel, customerCanUploadProof, formatOrderCode, STATUS_LABEL } from "./status";

describe("pedidos", () => {
  it("formatea el código con 4 dígitos", () => {
    expect(formatOrderCode(231)).toBe("#0231");
    expect(formatOrderCode(12345)).toBe("#12345");
  });
  it("etiquetas en español", () => {
    expect(STATUS_LABEL.esperando_pago).toBe("Esperando tu pago");
    expect(STATUS_LABEL.listo_para_recoger).toBe("Listo para recoger");
  });
  it("qué puede hacer el cliente según el estado", () => {
    expect(customerCanCancel("rechazado")).toBe(true);
    expect(customerCanCancel("esperando_pago")).toBe(true);
    expect(customerCanCancel("en_revision")).toBe(false);
    expect(customerCanUploadProof("rechazado")).toBe(true);
    expect(customerCanUploadProof("pagado")).toBe(false);
  });
});
