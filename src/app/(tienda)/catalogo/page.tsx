import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { getStoreSettings, listCategories, listProducts } from "@/features/catalog/cached";
import { CatalogFilters, CatalogSearch } from "@/features/catalog/CatalogFilters";
import { catalogHref, parseCatalogFilters } from "@/features/catalog/filters";
import { ProductGrid } from "@/features/catalog/ProductGrid";
import type { CatalogFilters as Filters } from "@/features/catalog/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({ searchParams }: PageProps<"/catalogo">): Promise<Metadata> {
  const [filters, categories, settings] = await Promise.all([
    searchParams.then(parseCatalogFilters),
    listCategories(),
    getStoreSettings(),
  ]);
  const category = categories.find((c) => c.slug === filters.categoria);
  return { title: `${category?.name ?? "Catálogo"} · ${settings.storeName}` };
}

function hasActiveFilters(f: Filters): boolean {
  return catalogHref(f) !== "/catalogo";
}

async function CatalogContent({ searchParams }: { searchParams: PageProps<"/catalogo">["searchParams"] }) {
  const [parsed, categories] = await Promise.all([searchParams.then(parseCatalogFilters), listCategories()]);
  // Una categoría que ya no existe (enlace viejo) se ignora y se muestra todo el catálogo.
  const category = categories.find((c) => c.slug === parsed.categoria);
  const filters: Filters = category ? parsed : { ...parsed, categoria: undefined };
  const products = await listProducts(filters);
  const chips = [{ slug: undefined, name: "Todos" }, ...categories];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{category?.name ?? "Catálogo"}</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {products.length === 1 ? "1 juego" : `${products.length} juegos`}
        </p>
      </div>

      <div className="mt-5">
        <CatalogSearch current={filters} />
      </div>

      <nav aria-label="Categorías" className="-mx-4 mt-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
          {chips.map((chip) => {
            const active = filters.categoria === chip.slug;
            return (
              <li key={chip.slug ?? "todos"}>
                <Link
                  href={catalogHref({ ...filters, categoria: chip.slug })}
                  aria-current={active ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors",
                    active ? "border-verde bg-verde text-crema" : "border-border bg-papel hover:border-madera",
                  )}
                >
                  {chip.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6 grid gap-6 md:grid-cols-[15rem_1fr] md:gap-8">
        <aside className="flex items-start justify-between gap-3 md:block">
          <CatalogFilters current={filters} />
          {hasActiveFilters(filters) && (
            <Link href="/catalogo" className="inline-flex h-11 items-center text-sm font-semibold text-verde underline-offset-4 hover:underline md:mt-4">
              Limpiar filtros
            </Link>
          )}
        </aside>

        <section aria-label="Resultados">
          {products.length > 0 ? (
            <ProductGrid products={products} columns={3} />
          ) : (
            <div className="rounded-3xl border border-dashed border-input bg-papel px-6 py-14 text-center">
              <p className="font-serif text-xl font-bold">No encontramos juegos con esos filtros</p>
              <p className="mt-2 text-muted-foreground">Prueba con otra categoría o quita algún filtro.</p>
              <Button asChild className="mt-6">
                <Link href="/catalogo">Limpiar filtros</Link>
              </Button>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function CatalogSkeleton() {
  return (
    <div aria-hidden className="animate-pulse">
      <div className="h-10 w-48 rounded-lg bg-crema-2" />
      <div className="mt-5 h-11 rounded-lg bg-crema-2" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="aspect-[3/4] rounded-2xl bg-crema-2" />
        ))}
      </div>
    </div>
  );
}

export default function CatalogoPage({ searchParams }: PageProps<"/catalogo">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Suspense fallback={<CatalogSkeleton />}>
        <CatalogContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
