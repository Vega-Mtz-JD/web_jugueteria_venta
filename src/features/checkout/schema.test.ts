import { describe, expect, it } from "vitest";
import { checkoutSchema, DEPARTMENTS, isValidCi, isValidNit, normalizePhone } from "./schema";

const base = { method: "recojo", recipientName: "Ana Quispe", phone: "71234567", invoiceRequested: false } as const;

function errorsOf(input: unknown) {
  const r = checkoutSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("normalizePhone", () => {
  it("acepta celulares bolivianos con prefijo y espacios", () => {
    expect(normalizePhone("+591 712 34567")).toBe("71234567");
    expect(normalizePhone("6 1234567")).toBe("61234567");
  });
  it("rechaza fijos y largos incorrectos", () => {
    expect(normalizePhone("21234567")).toBeNull();
    expect(normalizePhone("7123456")).toBeNull();
  });
});

describe("CI y NIT", () => {
  it("valida el CI con complemento o extensión", () => {
    expect(isValidCi("1234567")).toBe(true);
    expect(isValidCi("1234567-1A")).toBe(true);
    expect(isValidCi("1234567 LP")).toBe(true);
    expect(isValidCi("12a")).toBe(false);
  });
  it("valida el NIT", () => {
    expect(isValidNit("1020304050")).toBe(true);
    expect(isValidNit("12")).toBe(false);
  });
});

describe("checkoutSchema", () => {
  it("acepta un recojo mínimo y normaliza el celular", () => {
    const r = checkoutSchema.safeParse({ ...base, phone: "+591 712 34567" });
    expect(r.success && r.data.phone).toBe("71234567");
  });
  it("envío en la ciudad exige la zona", () => {
    expect(errorsOf({ ...base, method: "envio_ciudad" }).zoneId).toBe("Elige una zona");
  });
  it("encomienda exige CI, departamento y ciudad", () => {
    const e = errorsOf({ ...base, method: "encomienda" });
    expect(e.recipientCi).toBe("Escribe el CI de quien recoge");
    expect(e.department).toBe("Elige el departamento");
    expect(e.city).toBe("Escribe la ciudad");
  });
  it("la factura exige NIT y razón social", () => {
    const e = errorsOf({ ...base, invoiceRequested: true });
    expect(e.invoiceNit).toBe("Escribe el NIT o CI para la factura");
    expect(e.invoiceName).toBe("Escribe la razón social");
  });
  it("celular inválido", () => {
    expect(errorsOf({ ...base, phone: "123" }).phone).toBe("Escribe un celular de 8 dígitos (empieza con 6 o 7)");
  });
  it("tiene los 9 departamentos en orden", () => {
    expect(DEPARTMENTS).toEqual(["La Paz", "Cochabamba", "Santa Cruz", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Beni", "Pando"]);
  });
});
