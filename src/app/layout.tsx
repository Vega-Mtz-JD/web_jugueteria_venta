import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ludiq",
  description: "Juegos de mesa para pensar y compartir, en La Paz, Bolivia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
