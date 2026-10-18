import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getStoreSettings } from "@/features/catalog/cached";

export default async function TiendaLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings();
  return (
    <>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-verde px-4 py-2 font-semibold text-crema focus:not-sr-only focus:fixed focus:left-4 focus:top-3"
      >
        Saltar al contenido
      </a>
      <SiteHeader storeName={settings.storeName} />
      <main id="contenido" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </>
  );
}
