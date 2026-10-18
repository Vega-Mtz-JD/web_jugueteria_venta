import { describe, expect, it } from "vitest";
import { cartReducer, type CartLine } from "./cart-store";

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";

describe("cartReducer", () => {
  it("agregar dos veces suma la cantidad", () => {
    let lines: CartLine[] = [];
    lines = cartReducer(lines, { type: "add", productId: A, quantity: 1, maxStock: 5 });
    lines = cartReducer(lines, { type: "add", productId: A, quantity: 2, maxStock: 5 });
    expect(lines).toEqual([{ productId: A, quantity: 3 }]);
  });

  it("no supera el stock ni 20 unidades", () => {
    expect(cartReducer([], { type: "add", productId: A, quantity: 9, maxStock: 2 })).toEqual([{ productId: A, quantity: 2 }]);
    expect(cartReducer([], { type: "add", productId: A, quantity: 50, maxStock: 99 })).toEqual([{ productId: A, quantity: 20 }]);
  });

  it("sin stock no agrega nada", () => {
    expect(cartReducer([], { type: "add", productId: A, quantity: 1, maxStock: 0 })).toEqual([]);
  });

  it("poner cantidad 0 quita la línea", () => {
    expect(cartReducer([{ productId: A, quantity: 2 }], { type: "setQuantity", productId: A, quantity: 0, maxStock: 5 })).toEqual([]);
  });

  it("quitar y vaciar", () => {
    const lines = [{ productId: A, quantity: 1 }, { productId: B, quantity: 1 }];
    expect(cartReducer(lines, { type: "remove", productId: A })).toEqual([{ productId: B, quantity: 1 }]);
    expect(cartReducer(lines, { type: "clear" })).toEqual([]);
  });

  it("reconcile quita agotados o inexistentes y recorta al stock", () => {
    const lines = [{ productId: A, quantity: 2 }, { productId: B, quantity: 5 }, { productId: "otro", quantity: 1 }];
    expect(cartReducer(lines, { type: "reconcile", available: { [A]: 0, [B]: 2 } })).toEqual([{ productId: B, quantity: 2 }]);
  });
});
