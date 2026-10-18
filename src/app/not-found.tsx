import { NotFoundMessage } from "@/components/layout/NotFoundMessage";

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center">
      <NotFoundMessage title="No encontramos esta página" text="Revisa el enlace o vuelve al catálogo para seguir explorando." />
    </main>
  );
}
