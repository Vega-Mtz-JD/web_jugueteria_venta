import { test, expect } from "@playwright/test";
import { addToCart, loginAsNewUser } from "./helpers/session";
import { ordersOf, productId, setProduct } from "./helpers/supabase-admin";

const PAY_URL = /\/pedidos\/[0-9a-f-]{36}\/pago$/;

test.describe("checkout", () => {
  test("recojo en tienda crea el pedido esperando el pago", async ({ page }) => {
    const user = await loginAsNewUser(page);
    await addToCart(page, "uno");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Recojo en tienda/ }).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page).toHaveURL(PAY_URL);
    const [order] = await ordersOf(user.id);
    expect(order).toMatchObject({ status: "esperando_pago", delivery_method: "recojo", delivery_fee_cents: 0, total_cents: 3500 });
  });

  test("envío a domicilio suma la tarifa", async ({ page }) => {
    const user = await loginAsNewUser(page);
    await addToCart(page, "uno");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Envío dentro de La Paz/ }).check();
    await page.getByLabel("Zona", { exact: true }).selectOption({ label: "Sopocachi" });
    await expect(page.getByTestId("checkout-summary")).toContainText("Bs 15");
    await page.getByLabel("Dirección", { exact: true }).fill("Calle Aspiazu 123");
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page).toHaveURL(PAY_URL);
    expect((await ordersOf(user.id))[0]).toMatchObject({ delivery_fee_cents: 1500, total_cents: 5000 });
  });

  test("zona lejana: punto de encuentro sin costo", async ({ page }) => {
    const user = await loginAsNewUser(page);
    await addToCart(page, "uno");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Envío dentro de La Paz/ }).check();
    await page.getByLabel("Zona", { exact: true }).selectOption({ label: "El Alto (punto de encuentro)" });
    await page.getByRole("radio", { name: /Teleférico Rojo – estación Central/ }).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page).toHaveURL(PAY_URL);
    const [order] = await ordersOf(user.id);
    expect(order.delivery_fee_cents).toBe(0);
    expect(order.meeting_point_id).not.toBeNull();
  });

  test("encomienda sin CI y factura sin NIT muestran el error junto al campo", async ({ page }) => {
    await loginAsNewUser(page);
    await addToCart(page, "uno");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Encomienda por bus/ }).check();
    await expect(page.getByText("se paga al recoger la encomienda")).toBeVisible();
    await page.getByLabel("Departamento", { exact: true }).selectOption("Cochabamba");
    await page.getByLabel("Ciudad", { exact: true }).fill("Quillacollo");
    await page.getByLabel("¿Necesitas factura?").check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page.getByText("Escribe el CI de quien recoge")).toBeVisible();
    await expect(page.getByText("Escribe el NIT o CI para la factura")).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
  });

  test("doble clic crea un solo pedido", async ({ page }) => {
    const user = await loginAsNewUser(page);
    await addToCart(page, "uno");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Recojo en tienda/ }).check();
    await page.getByRole("button", { name: "Continuar al pago" }).dblclick();
    await expect(page).toHaveURL(PAY_URL);
    expect(await ordersOf(user.id)).toHaveLength(1);
  });

  test("si otro se llevó el stock, avisa y ajusta el carrito", async ({ page }) => {
    await loginAsNewUser(page);
    await addToCart(page, "hockey-de-mesa");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Recojo en tienda/ }).check();
    await setProduct("hockey-de-mesa", { stock: 0 });
    try {
      await page.getByRole("button", { name: "Continuar al pago" }).click();
      await expect(page.getByTestId("checkout-summary").getByRole("alert")).toContainText("Ya no queda stock suficiente de «Hockey de mesa»");
      await expect(page.getByRole("banner").getByRole("link", { name: /Ver carrito/ })).toHaveAccessibleName(/vacío/);
    } finally {
      await setProduct("hockey-de-mesa", { stock: 5 });
    }
  });

  test("un producto que ya no se vende se quita al llegar al checkout", async ({ page }) => {
    await loginAsNewUser(page);
    await addToCart(page, "uno");
    const risk = await productId("risk");
    await page.evaluate((id) => {
      const lines = JSON.parse(localStorage.getItem("ludiq:carrito:v1") ?? "[]");
      localStorage.setItem("ludiq:carrito:v1", JSON.stringify([...lines, { productId: id, quantity: 1 }]));
    }, risk);
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await expect(page.getByText(/Ajustamos tu carrito/)).toBeVisible();
    await expect(page.getByTestId("checkout-summary")).not.toContainText("Risk");
  });
});
