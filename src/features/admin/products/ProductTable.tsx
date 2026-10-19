import Image from "next/image";
import Link from "next/link";
import { formatBs } from "@/lib/money";
import type { AdminProductRow } from "../queries";
import { StockControls } from "./StockControls";

export function ProductTable({ products }: { products: AdminProductRow[] }) {
  if (products.length === 0) {
    return <p className="rounded-3xl border border-dashed border-input bg-papel px-6 py-12 text-center text-muted-foreground">No encontramos productos.</p>;
  }
  return (
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
      {products.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#eadcc4] bg-papel p-3 sm:flex-nowrap">
          <Link href={`/panel/productos/${p.id}`} className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto">
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-crema-2">
              <Image src={p.imageUrl} alt="" fill sizes="64px" unoptimized={p.imageUrl.endsWith(".svg")} className="object-contain p-1" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.name}</span>
              <span className="block text-sm text-muted-foreground">
                {formatBs(p.priceCents)} · {p.categoryName}
                {!p.isActive && <span className="ml-2 rounded-full bg-tinta/10 px-2 py-0.5 text-xs font-semibold text-tinta">Oculto</span>}
                {p.stock === 0 && <span className="ml-2 rounded-full bg-rojo/12 px-2 py-0.5 text-xs font-semibold text-rojo">Agotado</span>}
              </span>
            </span>
          </Link>
          <StockControls product={p} />
        </li>
      ))}
    </ul>
  );
}
