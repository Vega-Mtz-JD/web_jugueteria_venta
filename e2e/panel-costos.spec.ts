import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { newPurchase, receive } from "./helpers/purchases";
import { adminClient, createProduct, createSupplier } from "./helpers/supabase-admin";

test.describe("costo y ganancia en la ficha del producto", () => {
  test("costo de lo que ya tenía, luego la última compra, y pedir de nuevo por WhatsApp", async ({ page }) => {
    const product = await createProduct({ priceCents: 20000 });
    const supplier = await createSupplier({ whatsapp: "71234567", contactName: "Carlos" });
    await loginAsAdmin(page);

    await page.goto(`/panel/productos/${product.id}`);
    const costs = page.getByRole("region", { name: "Costo y ganancia" });
    await expect(costs).toContainText("Sin costo");
    await costs.getByLabel("Costo de lo que ya tenías (Bs)").fill("120");
    await costs.getByRole("button", { name: "Guardar costo" }).click();
    await expect(costs.getByTestId("cost-current")).toHaveText("Bs 120");
    await expect(costs).toContainText("Lo que ya tenías");
    await expect(costs.getByTestId("cost-margin")).toHaveText("Bs 80 (40 %)");

    await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "150" }] });
    await receive(page);
    await page.goto(`/panel/productos/${product.id}`);
    await expect(costs.getByTestId("cost-current")).toHaveText("Bs 150");
    await expect(costs).toContainText("Última compra");
    await expect(costs.getByTestId("cost-margin")).toHaveText("Bs 50 (25 %)");
    await expect(costs.getByRole("link", { name: "Pedir de nuevo por WhatsApp" })).toHaveAttribute(
      "href",
      new RegExp(`^https://wa\\.me/59171234567\\?text=.*${encodeURIComponent(product.name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  });

  test("un juego creado desde una compra no se muestra sin precio", async ({ page }) => {
    const supplier = await createSupplier();
    const game = `Juego sin precio e2e ${crypto.randomUUID().slice(0, 6)}`;
    await loginAsAdmin(page);
    await newPurchase(page, { supplier: supplier.name, lines: [{ newGame: game, quantity: "1", price: "50" }] });
    const { data } = await adminClient().from("products").select("id").eq("name", game).single();
    await page.goto(`/panel/productos/${data!.id}`);
    await page.getByLabel("Visible en la tienda").check();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Escribe un precio mayor que 0")).toBeVisible();
    const { data: after } = await adminClient().from("products").select("is_active").eq("id", data!.id).single();
    expect(after!.is_active).toBe(false);
  });
});
