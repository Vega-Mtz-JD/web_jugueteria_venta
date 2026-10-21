import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { newPurchase } from "./helpers/purchases";
import { adminClient, createProduct, createSupplier } from "./helpers/supabase-admin";

test.describe("compras: correcciones de la revisión", () => {
  test("«Pagar el saldo» al llegar sigue a lo que llegó, no a lo encargado", async ({ page }) => {
    const supplier = await createSupplier();
    const product = await createProduct();
    await loginAsAdmin(page);
    await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "10", price: "10" }], advance: { amount: "20" } });
    await page.getByRole("button", { name: "Llegó" }).click();
    const dialog = page.getByRole("dialog", { name: "Llegó la compra" });
    await dialog.getByRole("checkbox", { name: "Pagar el saldo ahora" }).check();
    await expect(dialog.getByLabel("Monto del saldo")).toHaveValue("80");
    await dialog.getByLabel(`Llegaron de «${product.name}»`).fill("8");
    await expect(dialog.getByLabel("Monto del saldo")).toHaveValue("60");
  });

  test("«Nuevo proveedor» y buscar el producto sin salir del formulario", async ({ page }) => {
    const product = await createProduct({ name: `Buscable e2e ${crypto.randomUUID().slice(0, 6)}` });
    const name = `Proveedor del formulario ${crypto.randomUUID().slice(0, 6)}`;
    await loginAsAdmin(page);
    await page.goto("/panel/compras/nueva");
    const row = page.getByRole("group", { name: "Producto 1" });
    await row.getByLabel("Buscar producto").fill(product.name);
    await expect(row.getByRole("combobox", { name: "Producto" }).locator("option")).toHaveCount(2); // "Elige…" + el encontrado
    await row.getByRole("combobox", { name: "Producto" }).selectOption({ label: product.name });
    await row.getByLabel("Cantidad").fill("2");
    await row.getByLabel("Precio por unidad").fill("30");

    await page.getByRole("button", { name: "Nuevo proveedor" }).click();
    const dialog = page.getByRole("dialog", { name: "Nuevo proveedor" });
    await dialog.getByLabel("Nombre").fill(name);
    await dialog.getByRole("button", { name: "Agregar proveedor" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("combobox", { name: "Proveedor" })).toHaveValue(/[0-9a-f-]{36}/);
    await expect(row.getByLabel("Precio por unidad")).toHaveValue("30"); // la línea no se perdió

    await page.getByRole("button", { name: "Guardar compra" }).click();
    await expect(page.getByRole("heading", { name: `Compra a ${name}` })).toBeVisible();
  });

  test("usar el saldo a favor dos veces sin recargar la página", async ({ page }) => {
    const supplier = await createSupplier();
    const product = await createProduct();
    await loginAsAdmin(page);
    const c = await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "5" }] });
    const b = await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "5" }] });
    await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "10" }], advance: { amount: "12" } });

    const use = async (target: string) => {
      await page.getByRole("button", { name: "Usar en otra compra" }).click();
      const dialog = page.getByRole("dialog", { name: "Usar el saldo en otra compra" });
      await dialog.getByRole("combobox", { name: "Compra destino" }).selectOption({ value: target });
      await dialog.getByRole("button", { name: "Usar saldo" }).click();
      await expect(dialog).toBeHidden();
    };
    await use(b);
    await expect(page.getByTestId("purchase-balance")).toContainText("Al día");

    await page.getByRole("button", { name: "Registrar pago" }).click();
    const pay = page.getByRole("dialog", { name: "Registrar pago" });
    await pay.getByLabel("Monto", { exact: true }).fill("3");
    await pay.getByRole("button", { name: "Guardar pago" }).click();
    await expect(page.getByTestId("purchase-balance")).toContainText("Saldo a favor: Bs 3");
    await use(c);
    await expect(page.getByTestId("purchase-balance")).toContainText("Al día");
    const { data } = await adminClient().from("purchase_payments").select("amount_cents").eq("purchase_id", c).eq("kind", "saldo_recibido");
    expect(data).toEqual([{ amount_cents: 300 }]);
  });
});
