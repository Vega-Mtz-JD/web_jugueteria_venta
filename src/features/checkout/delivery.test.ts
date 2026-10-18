import { describe, expect, it } from "vitest";
import { estimateDeliveryFee } from "./delivery";

const fees = { homeCents: 1500, meetingCents: 0 };

describe("estimateDeliveryFee", () => {
  it("recojo y encomienda no cobran envío", () => {
    expect(estimateDeliveryFee("recojo", null, fees)).toBe(0);
    expect(estimateDeliveryFee("encomienda", null, fees)).toBe(0);
  });
  it("en la ciudad depende del modo de la zona", () => {
    expect(estimateDeliveryFee("envio_ciudad", "domicilio", fees)).toBe(1500);
    expect(estimateDeliveryFee("envio_ciudad", "punto", fees)).toBe(0);
    expect(estimateDeliveryFee("envio_ciudad", null, fees)).toBe(0);
  });
});
