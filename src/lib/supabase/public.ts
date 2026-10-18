import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/**
 * Cliente anónimo sin sesión, para datos públicos (catálogo, ajustes de la tienda).
 * No lee cookies, así las páginas del catálogo pueden cachearse y probarse fuera de Next.
 */
export function createPublicSupabase(): SupabaseClient<Database> {
  const { url, anonKey } = supabaseEnv();
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
