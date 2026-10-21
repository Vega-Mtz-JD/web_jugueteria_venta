import { describe, expect, it } from "vitest";
import { reorderMessage } from "./reorder";

describe("reorderMessage", () => {
  it("saluda al contacto y pide la misma cantidad", () => {
    expect(reorderMessage({ supplierContact: "Carlos", supplierName: "Distribuidora Andina", productName: "Catán", quantity: 3 })).toBe(
      "Hola Carlos, ¿me puedes enviar de nuevo 3 × Catán? Gracias.",
    );
  });
  it("sin contacto, saluda al proveedor", () => {
    expect(reorderMessage({ supplierContact: null, supplierName: "Distribuidora Andina", productName: "UNO", quantity: 10 })).toBe(
      "Hola Distribuidora Andina, ¿me puedes enviar de nuevo 10 × UNO? Gracias.",
    );
  });
});
