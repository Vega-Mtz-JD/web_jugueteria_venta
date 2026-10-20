import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// La CLI sube [edge_runtime.secrets] de config.toml a la nube al cambiar secretos o desplegar:
// así llegaron a producción el buzón de prueba (inbucket) y las claves VAPID locales.
describe("supabase/config.toml", () => {
  it("no tiene secretos de las funciones (los locales van en supabase/functions/.env)", () => {
    expect(readFileSync("supabase/config.toml", "utf8")).not.toMatch(/^\[edge_runtime\.secrets\]/m);
  });
});
