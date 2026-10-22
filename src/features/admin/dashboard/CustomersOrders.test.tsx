import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomersOrders } from "./CustomersOrders";
import type { DashboardSales } from "./queries";

const data = { customers: { buyers: 0, new: 0, returning: 0 }, ordersByStatus: {} } as unknown as DashboardSales;

afterEach(cleanup);

describe("CustomersOrders", () => {
  it("agrupa los estados como el spec y no enlaza a listas con otro número", () => {
    render(<CustomersOrders data={{ ...data, ordersByStatus: { enviado: 1, listo_para_recoger: 2, cancelado: 1, rechazado: 1, entregado: 3 } }} />);
    const pedidos = screen.getByRole("region", { name: "Pedidos" });
    expect(pedidos).toHaveTextContent("Creados en este período");
    expect(pedidos).toHaveTextContent("Enviado o listo3");
    expect(pedidos).toHaveTextContent("Cancelado o rechazado2");
    expect(pedidos).toHaveTextContent("Entregado3");
    expect(pedidos.querySelectorAll("a")).toHaveLength(0);
  });
});
