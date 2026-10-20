import type { NextConfig } from "next";

// Fotos de productos: bucket público "product-images" del proyecto de Supabase (local o en la nube).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const localSupabase = /^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(supabaseUrl);

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [new URL(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/**`)],
    // Solo en la máquina de desarrollo/pruebas, donde Supabase corre en 127.0.0.1.
    dangerouslyAllowLocalIP: localSupabase,
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      // Tailwind solo procesa las hojas globales: con `as: "*.css"` los CSS modules
      // (*.module.css) perderían sus clases locales.
      "*.css": {
        condition: { not: { path: /\.module\.css$/ } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
