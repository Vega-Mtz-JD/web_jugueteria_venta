"use client";

import { Button } from "@/components/ui/button";
import { centsToBsText } from "../product-schema";
import type { SettingsData } from "../queries";
import { saveFeesAction, saveStoreAction } from "../settings-actions";
import { control, field, SaveStatus, useSave } from "./shared";

export function StoreForm({ store }: { store: SettingsData["store"] }) {
  const { pending, status, run } = useSave();
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const t = (k: string) => String(f.get(k) ?? "");
        run(() =>
          saveStoreAction({
            storeName: t("storeName"),
            tagline: t("tagline"),
            whatsappPhone: t("whatsappPhone"),
            address: t("address"),
            pickupHours: t("pickupHours"),
            zone: t("zone"),
            mapsUrl: t("mapsUrl"),
            coordinates: t("coordinates"),
          }),
        );
      }}
    >
      <label className={field}>
        Nombre de la tienda
        <input name="storeName" defaultValue={store.storeName} maxLength={80} className={control} />
      </label>
      <label className={field}>
        Lema
        <input name="tagline" defaultValue={store.tagline} maxLength={120} className={control} />
      </label>
      <label className={field}>
        WhatsApp
        <input name="whatsappPhone" type="tel" defaultValue={store.whatsappPhone} placeholder="+591 71234567" className={control} />
      </label>
      <label className={field}>
        Horario de recojo
        <input name="pickupHours" defaultValue={store.pickupHours} maxLength={120} className={control} />
      </label>
      <label className={`${field} sm:col-span-2`}>
        Dirección
        <input name="address" defaultValue={store.address} maxLength={200} className={control} />
      </label>
      <label className={field}>
        Zona (ej.: Sopocachi)
        <input name="zone" defaultValue={store.zone} maxLength={60} className={control} />
      </label>
      <label className={field}>
        Enlace de Google Maps
        <input name="mapsUrl" inputMode="url" defaultValue={store.mapsUrl} placeholder="https://maps.app.goo.gl/…" className={control} />
      </label>
      <label className={`${field} sm:col-span-2`}>
        Coordenadas
        <input name="coordinates" inputMode="decimal" defaultValue={store.coordinates} placeholder="-16.5103, -68.1267" aria-describedby="coordenadas-ayuda" className={control} />
        <span id="coordenadas-ayuda" className="text-sm font-normal text-muted-foreground">
          En Google Maps, mantén el dedo sobre la tienda y copia los números que aparecen arriba.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Guardar
        </Button>
        <SaveStatus status={status} />
      </div>
    </form>
  );
}

export function FeesForm({ fees }: { fees: SettingsData["fees"] }) {
  const { pending, status, run } = useSave();
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        run(() => saveFeesAction({ homeBs: String(f.get("home") ?? ""), meetingBs: String(f.get("meeting") ?? "") }));
      }}
    >
      <label className={field}>
        Envío a domicilio (Bs)
        <input name="home" inputMode="decimal" defaultValue={centsToBsText(fees.homeCents)} className={control} />
      </label>
      <label className={field}>
        Envío a punto de encuentro (Bs)
        <input name="meeting" inputMode="decimal" defaultValue={centsToBsText(fees.meetingCents)} className={control} />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Guardar
        </Button>
        <SaveStatus status={status} />
      </div>
    </form>
  );
}
