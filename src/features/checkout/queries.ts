import { cacheLife, cacheTag } from "next/cache";
import { CATALOG_TAG } from "@/features/catalog/cached";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { ZoneMode } from "./delivery";

export type CheckoutOptions = {
  zones: { id: string; name: string; mode: ZoneMode }[];
  meetingPoints: { id: string; name: string; reference: string | null }[];
  fees: { homeCents: number; meetingCents: number };
};

/** Zonas, puntos de encuentro y tarifas (datos públicos; el panel del plan 3 invalida CATALOG_TAG). */
export async function getCheckoutOptions(): Promise<CheckoutOptions> {
  "use cache";
  cacheLife("minutes");
  cacheTag(CATALOG_TAG);
  const supabase = createPublicSupabase();
  const [zones, points, settings] = await Promise.all([
    supabase.from("delivery_zones").select("id, name, mode").order("sort_order"),
    supabase.from("meeting_points").select("id, name, reference").order("sort_order"),
    supabase.from("store_settings").select("delivery_fee_home_cents, delivery_fee_meeting_cents").maybeSingle(),
  ]);
  if (zones.error) throw zones.error;
  if (points.error) throw points.error;
  return {
    zones: zones.data,
    meetingPoints: points.data,
    fees: {
      homeCents: settings.data?.delivery_fee_home_cents ?? 0,
      meetingCents: settings.data?.delivery_fee_meeting_cents ?? 0,
    },
  };
}
