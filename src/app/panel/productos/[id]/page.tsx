import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { DeleteProductButton } from "@/features/admin/products/DeleteProductButton";
import { MovementList } from "@/features/admin/products/MovementList";
import { PhotoManager } from "@/features/admin/products/PhotoManager";
import { ProductForm } from "@/features/admin/products/ProductForm";
import { StockControls } from "@/features/admin/products/StockControls";
import { CostPanel } from "@/features/admin/purchases/CostPanel";
import { getAdminProduct, getProductCostSummary } from "@/features/admin/queries";
import { listCategories } from "@/features/catalog/cached";

export const metadata: Metadata = { title: "Producto" };

async function ProductEditor({ params, searchParams }: PageProps<"/panel/productos/[id]">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [product, categories, costs] = await Promise.all([getAdminProduct(id), listCategories(), getProductCostSummary(id)]);
  if (!product) notFound();

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">{product.name}</h1>
        {/* Sin precarga: precargar la ficha mientras se guarda puede dejar en caché el precio viejo. */}
        {product.isActive && (
          <Link href={`/producto/${product.slug}`} prefetch={false} className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-verde underline-offset-4 hover:underline">
            Ver en la tienda
            <ExternalLinkIcon aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      {sp.nuevo === "1" && (
        <p role="status" className="mt-3 rounded-xl bg-verde/10 px-4 py-3 font-medium text-verde">
          Producto creado. Ahora agrégale fotos.
        </p>
      )}

      <section className="mt-6">
        <h2 className="mb-3 font-serif text-xl font-bold">Fotos</h2>
        <PhotoManager productId={product.id} productName={product.name} images={product.images} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 font-serif text-xl font-bold">Stock</h2>
        <StockControls product={product} full />
      </section>

      {costs && (
        <div className="mt-8">
          <CostPanel productId={product.id} productName={product.name} priceCents={product.priceCents} summary={costs} />
        </div>
      )}

      <section className="mt-8 max-w-2xl">
        <h2 className="mb-3 font-serif text-xl font-bold">Datos</h2>
        <ProductForm product={product} categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      </section>

      <section className="mt-8 max-w-2xl">
        <h2 className="mb-3 font-serif text-xl font-bold">Historial de stock</h2>
        <MovementList movements={product.movements} />
      </section>

      <div className="mt-8">
        <DeleteProductButton productId={product.id} />
      </div>

      <p className="mt-8">
        <Link href="/panel/productos" className="inline-flex min-h-11 items-center gap-2 font-semibold text-verde underline-offset-4 hover:underline">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Volver a productos
        </Link>
      </p>
    </>
  );
}

export default function PanelProductoPage(props: PageProps<"/panel/productos/[id]">) {
  return (
    <Suspense fallback={<div aria-hidden className="h-96 animate-pulse rounded-3xl bg-crema-2" />}>
      <ProductEditor {...props} />
    </Suspense>
  );
}
