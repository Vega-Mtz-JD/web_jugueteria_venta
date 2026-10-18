import Link from "next/link";
import { Button } from "@/components/ui/button";

export function NotFoundMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <span aria-hidden className="text-6xl">
        🧩
      </span>
      <h1 className="mt-6 text-3xl font-extrabold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground">{text}</p>
      <Button asChild size="lg" className="mt-8">
        <Link href="/catalogo">Ver catálogo</Link>
      </Button>
    </div>
  );
}
