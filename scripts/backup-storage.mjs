// Descarga todos los archivos de Supabase Storage a una carpeta (respaldo semanal en GitHub Actions).
// Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-storage.mjs <carpeta>
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const BUCKETS = ["payment-proofs", "shipping-proofs", "product-images", "store-assets"];
const PAGE = 1000;

const [outDir] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!outDir || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Uso: SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/backup-storage.mjs <carpeta>");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

/** Rutas de todos los archivos de un bucket (las carpetas vienen con id null y se recorren). */
async function listAll(bucket, prefix = "") {
  const paths = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) paths.push(...(await listAll(bucket, full)));
      else paths.push(full);
    }
    if (data.length < PAGE) return paths;
  }
}

let total = 0;
for (const bucket of BUCKETS) {
  for (const file of await listAll(bucket)) {
    const { data, error } = await supabase.storage.from(bucket).download(file);
    if (error) throw new Error(`${bucket}/${file}: ${error.message}`);
    const target = path.join(outDir, bucket, file);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    total++;
  }
}
console.log(`${total} archivos`);
