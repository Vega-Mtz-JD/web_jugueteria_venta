import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MessageCircleIcon, ShoppingBagIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getProductBySlug, getStoreSettings, listProducts } from "@/features/catalog/cached";
import { ProductGallery } from "@/features/catalog/ProductGallery";
import { ProductGrid } from "@/features/catalog/ProductGrid";
import { ageLabel, playersLabel } from "@/lib/labels";
import { formatBs } from "@/lib/money";
import { buildWhatsAppLink } from "@/lib/whatsapp";

const LOW_STOCK = 3;

// Con Cache Components hace falta al menos un parámetro; si aún no hay productos
// se usa un marcador que responde 404. Los productos nuevos se generan al primer visitante.
export async function generateStaticParams() {
  const products = await listProducts({ orden: "destacados" });
  return products.length > 0 ? products.map((p) => ({ slug: p.slug })) : [{ slug: "__sin-productos__" }];
}

export async function generateMetadata({ params }: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([getProductBySlug(slug), getStoreSettings()]);
  if (!product) return { title: `Juego no disponible · ${settings.storeName}` };
  const description = product.description ?? `${product.name} en ${settings.storeName}, ${formatBs(product.priceCents)}.`;
  return {
    title: `${product.name} · ${settings.storeName}`,
    description,
    openGraph: { title: product.name, description, images: [{ url: product.imageUrl }] },
  };
}

function availability(stock: number): string {
  if (stock === 0) return "Agotado";
  if (stock <= LOW_STOCK) return stock === 1 ? "Última unidad" : `Últimas ${stock} unidades`;
  return "En stock";
}

// Leer `params` va dentro de <Suspense>: para productos que no estaban en el build,
// Next sirve primero la cáscara común (App Shell) y luego transmite el contenido.
export default function ProductPage({ params }: PageProps<"/producto/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductContent params={params} />
    </Suspense>
  );
}

function ProductSkeleton() {
  return (
    <div aria-hidden className="mx-auto grid max-w-6xl animate-pulse gap-8 px-4 py-10 sm:px-6 md:grid-cols-2 md:gap-12">
      <div className="aspect-square rounded-3xl bg-crema-2" />
      <div className="space-y-4">
        <div className="h-10 w-3/4 rounded-lg bg-crema-2" />
        <div className="h-8 w-1/3 rounded-lg bg-crema-2" />
        <div className="h-24 rounded-lg bg-crema-2" />
      </div>
    </div>
  );
}

async function ProductContent({ params }: { params: PageProps<"/producto/[slug]">["params"] }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [settings, sameCategory] = await Promise.all([
    getStoreSettings(),
    listProducts({ categoria: product.categorySlug, orden: "destacados" }, 5),
  ]);
  const related = sameCategory.filter((p) => p.id !== product.id).slice(0, 4);
  const age = ageLabel(product.minAge);
  const players = playersLabel(product.minPlayers, product.maxPlayers);
  const soldOut = product.stock === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <nav aria-label="Migas de pan" className="mb-5 text-sm text-muted-foreground">
        <Link href="/catalogo" className="hover:text-foreground">
          Catálogo
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <Link href={`/catalogo?categoria=${product.categorySlug}`} className="hover:text-foreground">
          {product.categoryName}
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <ProductGallery
          images={product.images.length > 0 ? product.images : [{ url: product.imageUrl, alt: product.name }]}
          soldOut={soldOut}
        />

        <div>
          <div className="flex flex-wrap gap-1.5">
            {product.isNew && <Badge variant="nuevo">Nuevo</Badge>}
            {product.compareAtCents !== null && !soldOut && <Badge variant="oferta">Oferta</Badge>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{product.name}</h1>

          <p className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold">{formatBs(product.priceCents)}</span>
            {product.compareAtCents !== null && (
              <span className="text-lg text-muted-foreground line-through">{formatBs(product.compareAtCents)}</span>
            )}
          </p>

          {(age || players) && (
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {age && <li className="rounded-full bg-crema-2 px-3 py-1.5">{age}</li>}
              {players && <li className="rounded-full bg-crema-2 px-3 py-1.5">{players}</li>}
            </ul>
          )}

          <p className={soldOut ? "mt-4 font-semibold text-rojo" : "mt-4 font-semibold text-verde"}>
            {availability(product.stock)}
          </p>

          {product.description && <p className="mt-4 max-w-prose leading-relaxed text-tinta-suave">{product.description}</p>}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {/* El carrito llega en el plan 2. */}
            <Button size="lg" disabled className="sm:flex-1">
              <ShoppingBagIcon data-icon="inline-start" />
              {soldOut ? "Agotado" : "Muy pronto"}
            </Button>
            {settings.whatsappPhone && (
              <Button asChild size="lg" variant="outline" className="sm:flex-1">
                <a
                  href={buildWhatsAppLink(settings.whatsappPhone, `Hola, consulto por el producto “${product.name}”`)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircleIcon data-icon="inline-start" />
                  Consultar por WhatsApp
                </a>
              </Button>
            )}
          </div>
          {!soldOut && (
            <p className="mt-3 text-sm text-muted-foreground">
              Pronto podrás comprarlo aquí mismo. Mientras tanto, escríbenos y te lo separamos.
            </p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section data-testid="related" className="mt-14">
          <h2 className="mb-5 text-2xl font-extrabold tracking-tight">También te puede gustar</h2>
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
