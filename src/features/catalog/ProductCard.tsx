import Image from "next/image";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ageLabel } from "@/lib/labels";
import { formatBs } from "@/lib/money";
import { cn } from "@/lib/utils";
import styles from "./ProductCard.module.css";
import type { ProductCardData } from "./types";

function discountPercent(price: number, compareAt: number): number {
  return Math.round((1 - price / compareAt) * 100);
}

export function ProductCard({ product }: { product: ProductCardData }) {
  const age = ageLabel(product.minAge);
  return (
    <Link
      href={`/producto/${product.slug}`}
      data-testid="product-card"
      className={cn(
        styles.card,
        "group flex w-full min-w-0 flex-col rounded-2xl border border-[#eadcc4] bg-papel p-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-3",
      )}
    >
      <div className={cn(styles.media, "relative aspect-[4/3] overflow-hidden rounded-xl bg-crema-2")}>
        <div className="absolute left-2.5 top-2.5 z-10 flex gap-1.5">
          {!product.inStock && <Badge variant="agotado">Agotado</Badge>}
          {product.inStock && product.compareAtCents !== null && (
            <Badge variant="oferta">-{discountPercent(product.priceCents, product.compareAtCents)}%</Badge>
          )}
          {product.inStock && product.isNew && <Badge variant="nuevo">Nuevo</Badge>}
        </div>
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(min-width: 1200px) 25vw, (min-width: 768px) 33vw, 50vw"
          unoptimized={product.imageUrl.endsWith(".svg")}
          className={cn(styles.art, "object-contain p-3", !product.inStock && "opacity-60")}
        />
      </div>
      <div className="flex flex-1 flex-col px-1 pb-0.5 pt-3">
        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <span>{product.categoryName}</span>
          {age && <span>{age}</span>}
        </p>
        <h3 className="mt-1 line-clamp-2 font-serif text-[0.95rem] font-semibold leading-snug sm:text-base">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="flex flex-col leading-tight">
            {product.compareAtCents !== null && (
              <span className="text-xs text-muted-foreground line-through">{formatBs(product.compareAtCents)}</span>
            )}
            <span className="font-bold">{formatBs(product.priceCents)}</span>
          </p>
          {product.inStock && (
            <span
              aria-hidden
              className={cn(styles.add, "inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-verde text-crema")}
            >
              <PlusIcon className="size-5" />
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
