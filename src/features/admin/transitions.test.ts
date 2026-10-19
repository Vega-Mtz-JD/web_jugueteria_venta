import { describe, expect, it } from "vitest";
import { ACTION_TARGET, availableActions } from "./transitions";

describe("availableActions", () => {
  it("en revisión: confirmar o rechazar", () => {
    expect(availableActions("en_revision", "recojo")).toEqual(["confirmar", "rechazar"]);
  });
  it("pagado depende de la entrega", () => {
    expect(availableActions("pagado", "recojo")).toEqual(["listo", "reembolsar"]);
    expect(availableActions("pagado", "encomienda")).toEqual(["enviar", "reembolsar"]);
    expect(availableActions("pagado", "envio_ciudad")).toEqual(["enviar", "reembolsar"]);
  });
  it("enviado o listo: entregar o reembolsar", () => {
    expect(availableActions("enviado", "encomienda")).toEqual(["entregar", "reembolsar"]);
    expect(availableActions("listo_para_recoger", "recojo")).toEqual(["entregar", "reembolsar"]);
  });
  it("sin pagar o rechazado: solo cancelar", () => {
    expect(availableActions("esperando_pago", "recojo")).toEqual(["cancelar"]);
    expect(availableActions("rechazado", "envio_ciudad")).toEqual(["cancelar"]);
  });
  it("estados finales no tienen acciones", () => {
    for (const s of ["entregado", "cancelado", "reembolsado"] as const) expect(availableActions(s, "recojo")).toEqual([]);
  });
  it("cada acción va a su estado", () => {
    expect(ACTION_TARGET).toEqual({
      confirmar: "pagado",
      rechazar: "rechazado",
      listo: "listo_para_recoger",
      enviar: "enviado",
      entregar: "entregado",
      reembolsar: "reembolsado",
      cancelar: "cancelado",
    });
  });
});
