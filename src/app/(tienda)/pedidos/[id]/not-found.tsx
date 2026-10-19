import { NotFoundMessage } from "@/components/layout/NotFoundMessage";

export default function PedidoNotFound() {
  return (
    <NotFoundMessage
      title="No encontramos ese pedido"
      text="Revisa el enlace o entra a «Mis pedidos» con la cuenta con la que compraste."
    />
  );
}
