// Deja la base local como el seed ANTES del build de las e2e (el build pre-renderiza fichas
// con el stock del momento). Solo contra Supabase local. Uso: node e2e/reset-db.ts
import { execSync } from "node:child_process";

const SEED_STOCK: Record<string, number> = { uno: 20, "hockey-de-mesa": 5, carcassonne: 4, jenga: 2, "set-poker-200-fichas": 4 };

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const api: string = env.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(api)) throw new Error(`reset-db solo corre contra Supabase local (${api})`);
const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };

async function call(path: string, init: RequestInit) {
  const res = await fetch(`${api}/rest/v1/${path}`, { ...init, headers });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
}

await call("orders?id=not.is.null", { method: "DELETE" });
for (const [slug, stock] of Object.entries(SEED_STOCK)) {
  await call(`products?slug=eq.${slug}`, { method: "PATCH", body: JSON.stringify({ stock, is_active: true }) });
}
await call("products?slug=eq.risk", { method: "PATCH", body: JSON.stringify({ is_active: false }) });
console.log("e2e: base local repuesta al seed");
