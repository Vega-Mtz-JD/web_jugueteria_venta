import type { Metadata } from "next";
import { Suspense } from "react";
import { PanelShell } from "@/features/admin/PanelShell";
import { requireAdmin } from "@/features/admin/guard";
import { getStoreSettings } from "@/features/catalog/cached";

export const metadata: Metadata = {
  title: { default: "Panel", template: "%s · Panel" },
  robots: { index: false },
  // Instalable en el celular del dueño ("Agregar a la pantalla principal").
  manifest: "/panel.webmanifest",
  appleWebApp: { capable: true, title: "Panel", statusBarStyle: "default" },
  icons: { apple: "/icons/panel-192.png" },
};

async function AdminOnly({ storeName, children }: { storeName: string; children: React.ReactNode }) {
  await requireAdmin();
  return <PanelShell storeName={storeName}>{children}</PanelShell>;
}

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const settings = await getStoreSettings();
  return (
    <Suspense fallback={<div aria-hidden className="min-h-dvh flex-1 animate-pulse bg-crema" />}>
      <AdminOnly storeName={settings.storeName}>{children}</AdminOnly>
    </Suspense>
  );
}
