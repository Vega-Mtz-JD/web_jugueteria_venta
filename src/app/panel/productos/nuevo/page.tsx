import type { Metadata } from "next";
import { ProductForm } from "@/features/admin/products/ProductForm";
import { listCategories } from "@/features/catalog/cached";

export const metadata: Metadata = { title: "Nuevo producto" };

export default async function NuevoProductoPage() {
  const categories = await listCategories();
  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-3xl font-extrabold tracking-tight">Nuevo producto</h1>
      <ProductForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      <p className="mt-4 text-sm text-muted-foreground">Las fotos se agregan después de crearlo.</p>
    </div>
  );
}
