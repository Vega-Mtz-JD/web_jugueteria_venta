import Link from "next/link";
import type { Category } from "./types";

// Ícono y ejemplos por categoría; una categoría nueva creada por el dueño usa el valor por defecto.
const DETAILS: Record<string, { icon: string; examples: string }> = {
  estrategia: { icon: "♟️", examples: "Ajedrez, Catán, Carcassonne" },
  "clasicos-familia": { icon: "🎩", examples: "Monopolio, Scrabble, Jenga" },
  cartas: { icon: "🃏", examples: "UNO, Dobble y más" },
  casino: { icon: "🎰", examples: "Póker y ruleta" },
  "destreza-canchitas": { icon: "⚽", examples: "Canchitas, futbolín, hockey" },
  "cubos-rompecabezas": { icon: "🧩", examples: "Rubik, laberintos, retos" },
};
const DEFAULT_DETAILS = { icon: "🎲", examples: "Ver juegos" };

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <ul data-testid="category-grid" className="grid grid-cols-2 gap-2.5 sm:gap-3.5 lg:grid-cols-3">
      {categories.map((category) => {
        const details = DETAILS[category.slug] ?? DEFAULT_DETAILS;
        return (
          <li key={category.id} className="min-w-0">
            <Link
              href={`/catalogo?categoria=${category.slug}`}
              className="group relative block h-full min-h-28 overflow-hidden rounded-2xl bg-crema-2 p-3.5 pr-9 transition-[background-color,transform] duration-300 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-32 sm:p-5 sm:pr-20 [@media(hover:hover)]:hover:-translate-y-1"
            >
              <span className="block font-serif text-base font-bold leading-tight sm:text-lg">{category.name}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{details.examples}</span>
              <span
                aria-hidden
                className="absolute -bottom-2 -right-1 text-4xl transition-transform duration-500 ease-[cubic-bezier(.3,1.6,.5,1)] group-hover:-rotate-12 group-hover:scale-110 sm:text-6xl"
              >
                {details.icon}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
