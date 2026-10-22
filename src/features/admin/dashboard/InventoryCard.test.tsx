import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { InventoryCard } from "./InventoryCard";
import type { DashboardNow } from "./queries";

const inv = (o: Partial<DashboardNow["inventory"]> = {}): DashboardNow["inventory"] => ({
  products: 3, units: 5, costValueCents: 10_000_00, saleValueCents: 15_000_00, potentialProfitCents: 3_000_00,
  withoutCost: { products: 0, units: 0, items: [] }, withoutPrice: { products: 0, items: [] }, samplesWithStock: 0, ...o,
});

afterEach(cleanup);

describe("InventoryCard", () => {
  it("explica que 'ganarías' solo cuenta los juegos con costo y precio", () => {
    render(<InventoryCard inv={inv({ withoutCost: { products: 2, units: 4, items: [] }, withoutPrice: { products: 1, items: [] } })} />);
    expect(screen.getByText("Solo cuenta los juegos con costo y precio: faltan 2 sin costo y 1 sin precio.")).toBeInTheDocument();
  });
  it("si a ninguno le falta nada, no lo dice", () => {
    render(<InventoryCard inv={inv()} />);
    expect(screen.queryByText(/Solo cuenta los juegos/)).not.toBeInTheDocument();
  });
});
