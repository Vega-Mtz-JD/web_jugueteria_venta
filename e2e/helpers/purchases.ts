import { expect, type Page } from "@playwright/test";

type Line = { product?: string; newGame?: string; quantity: string; price: string };

/** Llena "Nueva compra" y la guarda; devuelve el id de la compra. */
export async function newPurchase(page: Page, o: { supplier: string; currency?: "Bolivianos" | "Dólares"; lines: Line[]; advance?: { amount: string; currency?: "Bolivianos" | "Dólares"; rate?: string } }) {
  await page.goto("/panel/compras/nueva");
  await page.getByRole("combobox", { name: "Proveedor" }).selectOption({ label: o.supplier });
  if (o.currency) await page.getByRole("radio", { name: o.currency }).check();
  for (const [i, l] of o.lines.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Agregar otro producto" }).click();
    const row = page.getByRole("group", { name: `Producto ${i + 1}` });
    if (l.newGame) {
      await row.getByRole("checkbox", { name: "Es un juego nuevo" }).check();
      await row.getByLabel("Nombre del juego nuevo").fill(l.newGame);
      await row.getByRole("combobox", { name: "Categoría del juego nuevo" }).selectOption({ label: "Estrategia" });
    } else {
      await row.getByRole("combobox", { name: "Producto" }).selectOption({ label: l.product! });
    }
    await row.getByLabel("Cantidad").fill(l.quantity);
    await row.getByLabel("Precio por unidad").fill(l.price);
  }
  if (o.advance) {
    const adv = page.getByRole("group", { name: "Adelanto (opcional)" });
    await adv.getByLabel("Monto del adelanto").fill(o.advance.amount);
    if (o.advance.currency) await adv.getByRole("combobox", { name: "Moneda del adelanto" }).selectOption({ label: o.advance.currency });
    if (o.advance.rate) await adv.getByLabel("A cuánto estaba el dólar").fill(o.advance.rate);
  }
  await page.getByRole("button", { name: "Guardar compra" }).click();
  await expect(page).toHaveURL(/\/panel\/compras\/[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

/** En el detalle de una compra encargada: "Llegó" con lo encargado y el envío dado. */
export async function receive(page: Page, shipping = "0") {
  await page.getByRole("button", { name: "Llegó" }).click();
  const dialog = page.getByRole("dialog", { name: "Llegó la compra" });
  await dialog.getByLabel("Costo de la encomienda (Bs)").fill(shipping);
  await dialog.getByRole("button", { name: "Guardar llegada" }).click();
  await expect(page.getByTestId("purchase-status")).toHaveText("Recibida");
}
