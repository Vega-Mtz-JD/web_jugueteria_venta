import type { Metadata } from "next";
import { Suspense } from "react";
import { getSettingsData } from "@/features/admin/queries";
import { AdminsEditor, SampleProductsButton } from "@/features/admin/settings/AdminsEditor";
import { CategoriesEditor, PointsEditor, ZonesEditor } from "@/features/admin/settings/ListEditors";
import { Section } from "@/features/admin/settings/shared";
import { FeesForm, StoreForm } from "@/features/admin/settings/StoreForms";
import { StorePhotosEditor } from "@/features/admin/settings/StorePhotosEditor";
import { WalletsEditor } from "@/features/admin/settings/WalletsEditor";

export const metadata: Metadata = { title: "Ajustes" };

const SECTIONS = [
  ["tienda", "Tienda"],
  ["fotos", "Fotos de la tienda"],
  ["envios", "Envíos"],
  ["zonas", "Zonas"],
  ["puntos", "Puntos de encuentro"],
  ["billeteras", "Billeteras QR"],
  ["categorias", "Categorías"],
  ["administradores", "Administradores"],
  ["muestras", "Productos de prueba"],
] as const;

async function Settings() {
  const data = await getSettingsData();
  return (
    <div className="grid gap-5">
      <Section id="tienda" title="Tienda" hint="Se muestra en el pie de la tienda y en los mensajes de WhatsApp.">
        <StoreForm store={data.store} />
      </Section>
      <Section id="fotos" title="Fotos de la tienda" hint="Se muestran en la portada como postal. Hasta 8, cada una con una frase corta.">
        <StorePhotosEditor photos={data.storePhotos} />
      </Section>
      <Section id="envios" title="Envíos" hint="Lo que se cobra por enviar dentro de La Paz. La encomienda la paga el comprador al recoger.">
        <FeesForm fees={data.fees} />
      </Section>
      <Section id="zonas" title="Zonas" hint="A domicilio: se lleva a la dirección. Punto de encuentro: para zonas alejadas.">
        <ZonesEditor zones={data.zones} />
      </Section>
      <Section id="puntos" title="Puntos de encuentro">
        <PointsEditor points={data.points} />
      </Section>
      <Section id="billeteras" title="Billeteras QR" hint="Reemplaza los QR de ejemplo por los reales de la tienda.">
        <WalletsEditor wallets={data.wallets} />
      </Section>
      <Section id="categorias" title="Categorías" hint="Solo se borran si no tienen productos.">
        <CategoriesEditor categories={data.categories} />
      </Section>
      <Section id="administradores" title="Administradores" hint="La persona primero crea su cuenta en la tienda; luego escribe aquí su correo.">
        <AdminsEditor admins={data.admins} me={data.me} />
      </Section>
      <Section id="muestras" title="Productos de prueba">
        <SampleProductsButton count={data.sampleCount} />
      </Section>
    </div>
  );
}

export default function AjustesPage() {
  return (
    <>
      <h1 className="mb-4 text-3xl font-extrabold tracking-tight">Ajustes</h1>
      <nav aria-label="Secciones de ajustes" className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-input bg-papel px-4 text-sm font-semibold hover:border-madera">
            {label}
          </a>
        ))}
      </nav>
      <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
        <Settings />
      </Suspense>
    </>
  );
}
