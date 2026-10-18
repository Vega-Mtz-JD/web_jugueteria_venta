import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import type { ProductCardData } from "./types";

/** columns = máximo de columnas en pantallas grandes (3 cuando hay una columna lateral de filtros). */
export function ProductGrid({ products, columns = 4 }: { products: ProductCardData[]; columns?: 3 | 4 }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3", columns === 4 && "xl:grid-cols-4")}>
      {products.map((product) => (
        <li key={product.id} className="flex min-w-0">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
