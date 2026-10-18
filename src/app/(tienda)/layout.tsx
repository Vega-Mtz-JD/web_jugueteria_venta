import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { getStoreSettings } from "@/features/catalog/cached";

export default async function TiendaLayout({ children }: LayoutProps<"/">) {
  const settings = await getStoreSettings();
  return (
    <>
      <SiteHeader storeName={settings.storeName} />
      <main className="flex-1">{children}</main>
      <SiteFooter settings={settings} />
    </>
  );
}
