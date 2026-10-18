import { ProductCard } from "./ProductCard";
import type { ProductCardData } from "./types";

export function ProductGrid({ products }: { products: ProductCardData[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <li key={product.id} className="flex min-w-0">
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}
