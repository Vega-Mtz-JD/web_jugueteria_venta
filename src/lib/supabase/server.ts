import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { connection } from "next/server";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

/** Cliente con la sesión del usuario (cookies). Para Server Components, Server Actions y Route Handlers. */
export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  // El cliente con sesión siempre se arma al momento de la petición: Supabase lee la hora
  // (Date.now) al iniciar, y en un prerender o precarga parcial eso no está permitido.
  await connection();
  const { url, anonKey } = supabaseEnv();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy refresca la sesión (plan 2).
        }
      },
    },
  });
}
