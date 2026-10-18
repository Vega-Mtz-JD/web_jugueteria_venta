import { describe, expect, it } from "vitest";
import { buildWhatsAppLink } from "./whatsapp";

describe("buildWhatsAppLink", () => {
  it("deja solo dígitos del teléfono y codifica el mensaje", () => {
    expect(buildWhatsAppLink("+591 712-34567", "Hola, consulto por Catán")).toBe(
      "https://wa.me/59171234567?text=Hola%2C%20consulto%20por%20Cat%C3%A1n",
    );
  });
});
