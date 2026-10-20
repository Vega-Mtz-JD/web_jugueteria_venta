import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

// Supabase local: la clave de servicio sale de `supabase status` (nunca de un archivo del repo).
const local = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = crypto.randomUUID();
const files = [
  { bucket: "product-images", path: `zz-respaldo-${tag}/a.png`, body: "foto a" },
  { bucket: "product-images", path: `zz-respaldo-${tag}/sub/b.png`, body: "foto b" },
  { bucket: "payment-proofs", path: `zz-respaldo-${tag}/captura.png`, body: "captura" },
];
const out = mkdtempSync(path.join(tmpdir(), "respaldo-"));

afterAll(async () => {
  for (const f of files) await admin.storage.from(f.bucket).remove([f.path]);
  rmSync(out, { recursive: true, force: true });
});

describe("backup-storage.mjs", () => {
  it("descarga los archivos de los buckets, carpetas incluidas", async () => {
    for (const f of files) {
      const { error } = await admin.storage.from(f.bucket).upload(f.path, new Blob([f.body], { type: "image/png" }), { contentType: "image/png" });
      if (error) throw error;
    }
    const stdout = execFileSync("node", ["scripts/backup-storage.mjs", out], {
      encoding: "utf8",
      env: { ...process.env, SUPABASE_URL: local.API_URL, SUPABASE_SERVICE_ROLE_KEY: local.SERVICE_ROLE_KEY },
    });
    expect(stdout).toMatch(/\d+ archivos/);
    for (const f of files) expect(readFileSync(path.join(out, f.bucket, f.path), "utf8")).toBe(f.body);
  }, 60_000);
});
