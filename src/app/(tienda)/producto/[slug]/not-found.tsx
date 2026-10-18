import { NotFoundMessage } from "@/components/layout/NotFoundMessage";

export default function ProductNotFound() {
  return (
    <NotFoundMessage
      title="Este juego ya no está disponible"
      text="Puede que se haya agotado o que el enlace sea antiguo. Mira lo que tenemos ahora en el catálogo."
    />
  );
}
