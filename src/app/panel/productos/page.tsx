import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductTable } from "@/features/admin/products/ProductTable";
import { listAdminProducts, type ProductFilter } from "@/features/admin/queries";
import { listCategories } from "@/features/catalog/cached";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Productos" };

const FILTERS: { value: ProductFilter; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "visibles", label: "Visibles" },
  { value: "ocultos", label: "Ocultos" },
  { value: "poco-stock", label: "Poco stock" },
  { value: "agotados", label: "Agotados" },
];

async function Products({ searchParams }: { searchParams: PageProps<"/panel/productos">["searchParams"] }) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const q = one(sp.q)?.slice(0, 80) ?? "";
  const categoryId = one(sp.categoria) ?? "";
  const filter = FILTERS.find((f) => f.value === one(sp.filtro))?.value ?? "todos";
  const [products, categories] = await Promise.all([listAdminProducts({ q, categoryId, filter }), listCategories()]);
  const href = (f: ProductFilter) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (categoryId) params.set("categoria", categoryId);
    if (f !== "todos") params.set("filtro", f);
    const s = params.toString();
    return s ? `/panel/productos?${s}` : "/panel/productos";
  };

  return (
    <>
      {one(sp.borrado) === "1" && (
        <p role="status" className="mb-4 rounded-xl bg-verde/10 px-4 py-3 font-medium text-verde">
          Producto borrado
        </p>
      )}
      <form className="mb-3 flex flex-wrap gap-2" role="search">
        {filter !== "todos" && <input type="hidden" name="filtro" value={filter} />}
        <label className="sr-only" htmlFor="buscar-producto">
          Buscar producto
        </label>
        <input
          id="buscar-producto"
          name="q"
          defaultValue={q}
          placeholder="Buscar producto"
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-papel px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <label className="sr-only" htmlFor="filtro-categoria">
          Categoría
        </label>
        <select id="filtro-categoria" name="categoria" defaultValue={categoryId} className="h-11 rounded-xl border border-input bg-papel px-3 text-base">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit" className="h-11 rounded-xl bg-verde px-5 font-semibold text-crema hover:bg-verde-2">
          Buscar
        </button>
      </form>
      <nav aria-label="Filtrar productos" className="mb-5 flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value)}
            aria-current={f.value === filter ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap",
              f.value === filter ? "border-verde bg-verde text-crema" : "border-input bg-papel hover:border-madera",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      <ProductTable products={products} />
    </>
  );
}

export default function PanelProductosPage({ searchParams }: PageProps<"/panel/productos">) {
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Productos</h1>
        <Button asChild>
          <Link href="/panel/productos/nuevo">
            <PlusIcon data-icon="inline-start" />
            Nuevo producto
          </Link>
        </Button>
      </div>
      <Suspense fallback={<div aria-hidden className="h-64 animate-pulse rounded-3xl bg-crema-2" />}>
        <Products searchParams={searchParams} />
      </Suspense>
    </>
  );
}
