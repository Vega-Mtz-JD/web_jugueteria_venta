/** Dirección web de un producto a partir de su nombre: "Catán: Ciudades" → "catan-ciudades". */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 80)
    .replace(/^-+|-+$/g, "");
  return slug || "producto";
}

/** `base` si está libre; si no, `base-2`, `base-3`… (los usados vienen de la base). */
export function nextFreeSlug(base: string, used: string[]): string {
  const taken = new Set(used);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
