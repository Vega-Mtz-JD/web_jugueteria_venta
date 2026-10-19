"use server";

import { z } from "zod";
import { listProductsByIds } from "@/features/catalog/queries";

/** Datos al día (sin caché) de los productos del carrito; los que no vuelven ya no se venden. */
export async function getCartProducts(ids: string[]) {
  const parsed = z.array(z.uuid()).max(30).safeParse(ids);
  if (!parsed.success || parsed.data.length === 0) return [];
  return listProductsByIds(parsed.data);
}
