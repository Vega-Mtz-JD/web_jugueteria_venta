// Solo para pruebas locales: usa la clave service role de Supabase local para preparar datos.
import { execSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

function localEnv(): Record<string, string> {
  const out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  return Object.fromEntries(
    out
      .split("\n")
      .map((line) => line.match(/^([A-Z_]+)="?(.*?)"?$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
}

export function adminClient(): SupabaseClient {
  if (!cached) {
    const env = localEnv();
    cached = createClient(env.API_URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  }
  return cached;
}

export const TEST_PASSWORD = "clave-de-prueba-123";

export async function createTestUser(fullName = "Ana Prueba", email = `e2e-${crypto.randomUUID()}@test.bo`) {
  const { data, error } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return { id: data.user.id, email, password: TEST_PASSWORD, fullName };
}

export async function setOrderStatus(orderId: string, status: string, extra: Record<string, unknown> = {}) {
  const { error } = await adminClient().from("orders").update({ status, ...extra }).eq("id", orderId);
  if (error) throw error;
}

export async function setProduct(slug: string, values: Record<string, unknown>) {
  const { error } = await adminClient().from("products").update(values).eq("slug", slug);
  if (error) throw error;
}

export async function productStock(slug: string): Promise<number> {
  const { data, error } = await adminClient().from("products").select("stock").eq("slug", slug).single();
  if (error) throw error;
  return data.stock;
}

/** Último correo recibido en Mailpit (Supabase local) para una dirección. */
export async function latestEmailHtml(to: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages?.length) {
      const msg = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${messages[0].ID}`)).json();
      return msg.HTML as string;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No llegó ningún correo a ${to}`);
}

export async function productId(slug: string): Promise<string> {
  const { data, error } = await adminClient().from("products").select("id").eq("slug", slug).single();
  if (error) throw error;
  return data.id;
}

export async function ordersOf(customerId: string) {
  const { data, error } = await adminClient()
    .from("orders")
    .select("id, number, status, delivery_method, delivery_fee_cents, total_cents, meeting_point_id, invoice_requested")
    .eq("customer_id", customerId)
    .order("created_at");
  if (error) throw error;
  return data;
}
