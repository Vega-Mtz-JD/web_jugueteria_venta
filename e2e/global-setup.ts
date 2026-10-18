// Antes de cada corrida e2e local: deja la base como el seed. Las pruebas de compra reservan
// stock y, sin esto, varias corridas seguidas terminan agotando productos (los pedidos vencen
// recién a los 60 minutos).
import { adminClient } from "./helpers/supabase-admin";

const SEED_STOCK: Record<string, number> = { uno: 20, "hockey-de-mesa": 5, carcassonne: 4, jenga: 2, "set-poker-200-fichas": 4 };

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL) return; // contra una vista previa no se toca ninguna base
  const admin = adminClient();
  // @ts-expect-error -- supabaseUrl es interno pero estable; sirve para no tocar nunca una base remota
  const url: string = admin.supabaseUrl;
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) throw new Error(`global-setup solo corre contra Supabase local (${url})`);

  const { error } = await admin.from("orders").delete().not("id", "is", null);
  if (error) throw error;
  for (const [slug, stock] of Object.entries(SEED_STOCK)) {
    const { error: e } = await admin.from("products").update({ stock }).eq("slug", slug);
    if (e) throw e;
  }
}
