import { ArrowRightIcon, BusIcon, QrCodeIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { Cube3D } from "@/components/brand/Cube3D";
import { FloatingPieces } from "@/components/brand/FloatingPieces";
import { IllimaniLandscape } from "@/components/brand/IllimaniLandscape";
import { MotionToggle } from "@/components/brand/MotionToggle";
import { RevealItem } from "@/components/brand/Reveal";
import { Button } from "@/components/ui/button";
import { CategoryGrid } from "@/features/catalog/CategoryGrid";
import { listCategories, listProducts } from "@/features/catalog/cached";
import { ProductGrid } from "@/features/catalog/ProductGrid";

const TRUST = [
  { icon: BusIcon, text: "Envíos a toda Bolivia" },
  { icon: QrCodeIcon, text: "Paga con QR" },
  { icon: StoreIcon, text: "Recojo en tienda" },
];

function SectionHeading({ title, href, linkText }: { title: string; href: string; linkText: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h2>
      <Link href={href} className="shrink-0 text-sm font-semibold text-verde underline-offset-4 hover:underline">
        {linkText}
      </Link>
    </div>
  );
}

export default async function Home() {
  const [categories, featured] = await Promise.all([listCategories(), listProducts({ orden: "destacados" }, 8)]);

  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#f6efe3_0%,#f3e3cf_55%,#efd9bf_100%)]">
        <div
          aria-hidden
          className="absolute right-[28%] top-[8%] size-44 rounded-full bg-[radial-gradient(circle,#f2c879_0,#f2c87955_40%,transparent_70%)]"
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[210px] md:h-[78%]">
          <IllimaniLandscape />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-6 px-4 pb-44 pt-8 sm:px-6 md:grid-cols-[1.15fr_1fr] md:pb-32 md:pt-14">
          <div className="order-2 md:order-1">
            <RevealItem step={0}>
              <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#e4ecdf] px-3 py-1 text-sm font-semibold text-verde">
                <span aria-hidden>♟</span> Juegos de mesa en La Paz
              </p>
            </RevealItem>
            <div>
              <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] font-extrabold leading-[1.02] tracking-[-0.02em]">
                El arte de{" "}
                <em className="relative z-0 text-verde after:absolute after:inset-x-0 after:bottom-1 after:-z-10 after:h-2.5 after:rounded after:bg-mostaza/35">
                  pensar
                </em>
                , en tu mesa.
              </h1>
            </div>
            <RevealItem step={1}>
              <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-tinta-suave">
                Ajedrez, cubos, juegos de cartas, de casino y de destreza. Elegidos para regalar, aprender y jugar en
                familia.
              </p>
            </RevealItem>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/catalogo">
                  Explorar catálogo
                  <ArrowRightIcon data-icon="inline-end" className="transition-transform group-hover/button:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/catalogo?ofertas=1">Ver ofertas</Link>
              </Button>
            </div>
            <RevealItem step={2}>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-tinta-suave">
                {TRUST.map(({ icon: Icon, text }) => (
                  <li key={text} className="inline-flex items-center gap-1.5">
                    <Icon aria-hidden className="size-4 text-verde" />
                    {text}
                  </li>
                ))}
              </ul>
            </RevealItem>
          </div>

          <div className="relative order-1 flex h-60 items-center justify-center md:order-2 md:h-80">
            <div
              aria-hidden
              className="absolute size-52 rounded-full bg-verde md:size-64"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(#2c6a5080 0 25%, transparent 0 50%)",
                backgroundSize: "34px 34px",
              }}
            />
            <FloatingPieces />
            <Cube3D />
            <div className="absolute bottom-0 right-0">
              <MotionToggle />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <SectionHeading title="Explora por tipo" href="/catalogo" linkText="Ver todo" />
        <CategoryGrid categories={categories} />
      </section>

      <section data-testid="featured" className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
        <SectionHeading title="Destacados" href="/catalogo" linkText="Ver catálogo" />
        <ProductGrid products={featured} />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14 sm:px-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-verde p-6 text-crema sm:flex-row sm:items-center sm:p-8">
          <QrCodeIcon aria-hidden className="size-10 shrink-0 text-cubo-mostaza" />
          <div className="flex-1">
            <h2 className="text-xl font-bold sm:text-2xl">Paga fácil con QR</h2>
            <p className="mt-1 text-crema/85">Escanea, paga y sube la captura. Nosotros confirmamos tu pedido.</p>
          </div>
          <ul className="flex flex-wrap gap-2">
            {["Yape", "Altoke", "Yasta"].map((wallet) => (
              <li key={wallet} translate="no" className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-sm font-semibold">
                {wallet}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
