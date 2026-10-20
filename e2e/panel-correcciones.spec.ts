import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { createOrderFor, createProduct, createTestUser, productStock, setOrderStatus } from "./helpers/supabase-admin";

const NETWORK = "No pudimos conectar. Revisa tu conexión y vuelve a intentarlo.";
const isAction = (r: { method(): string; headers(): Record<string, string> }) => r.method() === "POST" && "next-action" in r.headers();

/** Corta la conexión de las Server Actions: "antes" no llegan al servidor; "después" llegan pero se pierde la respuesta. */
async function cutActions(page: Page, when: "antes" | "después") {
  await page.route("**/*", async (route) => {
    if (!isAction(route.request())) return route.continue();
    if (when === "después") await route.fetch();
    await route.abort("internetdisconnected");
  });
}

test.describe("correcciones de la revisión del panel", () => {
  test("sin señal, una acción avisa en el lugar y no muestra «tienda no disponible»", async ({ page }) => {
    const order = await createOrderFor((await createTestUser("Rosa Mamani")).id);
    await setOrderStatus(order.id, "en_revision");
    await loginAsAdmin(page);
    await page.goto(`/panel/pedidos/${order.id}`);
    await cutActions(page, "antes");
    await page.getByRole("button", { name: "Confirmar pago" }).click();
    await expect(page.getByRole("alert").filter({ hasText: NETWORK })).toBeVisible();
    await expect(page.getByText("no está disponible")).toHaveCount(0);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await page.getByRole("button", { name: "Confirmar pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Pagado");
  });

  test("respuesta perdida al registrar «Vendí»: el reintento no la cuenta dos veces", async ({ page }) => {
    const product = await createProduct({ stock: 5 });
    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);
    await page.getByRole("button", { name: "Vendí" }).click();
    const dialog = page.getByRole("dialog", { name: "Vendí" });
    await cutActions(page, "después");
    await dialog.getByRole("button", { name: "Registrar venta" }).click();
    await expect(dialog.getByRole("alert")).toHaveText(NETWORK);
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await dialog.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByTestId("stock")).toHaveText("4");
    expect(await productStock(product.slug)).toBe(4);
  });

  test("dos ventas seguidas cuentan las dos", async ({ page }) => {
    const product = await createProduct({ stock: 5 });
    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);
    for (const left of ["4", "3"]) {
      await page.getByRole("button", { name: "Vendí" }).click();
      await page.getByRole("dialog", { name: "Vendí" }).getByRole("button", { name: "Registrar venta" }).click();
      await expect(page.getByTestId("stock")).toHaveText(left);
    }
    expect(await productStock(product.slug)).toBe(3);
  });

  test("con stock 0 y la unidad apartada, «Vendí» explica qué pedido la tiene", async ({ page }) => {
    const product = await createProduct({ stock: 0 });
    const order = await createOrderFor((await createTestUser("Rosa Mamani")).id, product.slug);
    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);
    await page.getByRole("button", { name: "Vendí" }).click();
    const dialog = page.getByRole("dialog", { name: "Vendí" });
    await dialog.getByRole("button", { name: "Registrar venta" }).click();
    await expect(dialog.getByRole("alert")).toContainText(`apartadas por el pedido #${String(order.number).padStart(4, "0")} (vence a las`);
  });
});
