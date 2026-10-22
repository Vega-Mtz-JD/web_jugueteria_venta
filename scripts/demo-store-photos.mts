// Solo local: 8 fotos de prueba (1600×1200, con ruido para pesar como una foto real) en la postal de la portada,
// para medir la rapidez con Lighthouse. Uso: node scripts/demo-store-photos.mts   ·   --clean para quitarlas.
import { execSync } from "node:child_process";
import { chromium } from "@playwright/test";

const env = Object.fromEntries(
  execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    .split("\n")
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => [m[1], m[2]]),
);
const api: string = env.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(api)) throw new Error(`demo-store-photos solo corre contra Supabase local (${api})`);
const auth = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}` };
const json = { ...auth, "Content-Type": "application/json" };

async function ok(res: Response) {
  if (!res.ok) throw new Error(`${res.url}: ${res.status} ${await res.text()}`);
  return res;
}

async function clean() {
  await ok(await fetch(`${api}/rest/v1/store_photos?path=like.tienda/demo-*`, { method: "DELETE", headers: json }));
  const listed = await (await ok(await fetch(`${api}/storage/v1/object/list/product-images`, { method: "POST", headers: json, body: JSON.stringify({ prefix: "tienda", limit: 1000 }) }))).json();
  const demo = (listed as { name: string }[]).filter((f) => f.name.startsWith("demo-")).map((f) => `tienda/${f.name}`);
  if (demo.length) await ok(await fetch(`${api}/storage/v1/object/product-images`, { method: "DELETE", headers: json, body: JSON.stringify({ prefixes: demo }) }));
  await ok(await fetch(`${api}/rest/v1/store_settings?id=eq.1`, { method: "PATCH", headers: json, body: JSON.stringify({ zone: null, maps_url: null, latitude: null, longitude: null }) }));
}

await clean();
if (process.argv.includes("--clean")) {
  console.log("demo: fotos de prueba quitadas");
  process.exit(0);
}

const CAPTIONS = ["Nuestra vitrina", "El Illimani desde la tienda", "Ajedrez para todos", "La Paz de noche", "Cubos y rompecabezas", "El teleférico", "Juegos en familia", "Plaza Murillo"];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [i, caption] of CAPTIONS.entries()) {
  const base64 = await page.evaluate((hue) => {
    const c = document.createElement("canvas");
    c.width = 1600;
    c.height = 1200;
    const g = c.getContext("2d")!;
    const grad = g.createLinearGradient(0, 0, 1600, 1200);
    grad.addColorStop(0, `hsl(${hue} 55% 55%)`);
    grad.addColorStop(1, `hsl(${(hue + 60) % 360} 45% 30%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 1600, 1200);
    const img = g.getImageData(0, 0, 1600, 1200);
    for (let p = 0; p < img.data.length; p += 4) {
      const n = (Math.random() - 0.5) * 40;
      img.data[p] += n;
      img.data[p + 1] += n;
      img.data[p + 2] += n;
    }
    g.putImageData(img, 0, 0);
    return c.toDataURL("image/webp", 0.82).split(",")[1];
  }, i * 45);
  const path = `tienda/demo-${i + 1}.webp`;
  await ok(await fetch(`${api}/storage/v1/object/product-images/${path}`, { method: "POST", headers: { ...auth, "Content-Type": "image/webp" }, body: Buffer.from(base64, "base64") }));
  await ok(await fetch(`${api}/rest/v1/store_photos`, { method: "POST", headers: json, body: JSON.stringify({ path, caption, sort_order: i }) }));
}
await browser.close();
await ok(
  await fetch(`${api}/rest/v1/store_settings?id=eq.1`, {
    method: "PATCH",
    headers: json,
    body: JSON.stringify({ zone: "Sopocachi", maps_url: "https://maps.app.goo.gl/AbC123", latitude: -16.5103, longitude: -68.1267 }),
  }),
);
console.log("demo: 8 fotos de prueba en la postal");
