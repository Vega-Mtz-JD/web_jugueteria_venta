import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { chooseProof, loginAsNewUser } from "./helpers/session";
import { createOrderFor, createTestUser, productStock, setOrderStatus } from "./helpers/supabase-admin";

const code = (n: number) => `#${String(n).padStart(4, "0")}`;

async function uploadProof(page: Page, orderId: string) {
  await page.goto(`/pedidos/${orderId}/pago`);
  await chooseProof(page, path.join(__dirname, "fixtures", "captura.png"));
  await page.getByRole("button", { name: "Enviar pedido" }).click();
  await expect(page).toHaveURL(new RegExp(`/pedidos/${orderId}$`), { timeout: 15000 }); // comprime y sube la imagen
}

test.describe("mis pedidos", () => {
  test("la lista muestra solo mis pedidos", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const a = await createOrderFor(user.id);
    const b = await createOrderFor(user.id);
    const other = await createOrderFor((await createTestUser("Otra Persona")).id);
    await page.goto("/pedidos");
    await expect(page.getByRole("link", { name: new RegExp(code(a.number)) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(code(b.number)) })).toBeVisible();
    await expect(page.getByText(code(other.number))).toHaveCount(0);
  });

  test("un pago rechazado muestra el motivo y permite subir otra captura", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id);
    await uploadProof(page, order.id);
    await expect(page.getByText("En revisión").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar pedido" })).toHaveCount(0);
    await setOrderStatus(order.id, "rechazado", { rejection_reason: "Monto incorrecto" });
    await page.reload();
    await expect(page.getByText("Monto incorrecto")).toBeVisible();
    await page.getByRole("link", { name: "Subir otra captura" }).click();
      await chooseProof(page, path.join(__dirname, "fixtures", "captura.png"));
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/pedidos/${order.id}$`), { timeout: 15000 }); // comprime y sube la imagen
    await expect(page.getByText("En revisión").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Captura \d/ })).toHaveCount(2);
  });

  test("cancelar un pedido rechazado devuelve el stock", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id, "set-poker-200-fichas");
    await setOrderStatus(order.id, "rechazado", { rejection_reason: "No se ve el pago" });
    const before = await productStock("set-poker-200-fichas");
    await page.goto(`/pedidos/${order.id}`);
    await page.getByRole("button", { name: "Cancelar pedido" }).click();
    await page.getByRole("button", { name: "Sí, cancelar" }).click();
    await expect(page.getByText("Cancelado").first()).toBeVisible();
    expect(await productStock("set-poker-200-fichas")).toBe(before + 1);
  });

  test("consulta por WhatsApp con el código del pedido", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id);
    await page.goto(`/pedidos/${order.id}`);
    await expect(page.getByRole("link", { name: "Consultar por WhatsApp" })).toHaveAttribute(
      "href",
      new RegExp(`text=Hola%2C%20consulto%20por%20mi%20pedido%20%23${String(order.number).padStart(4, "0")}`),
    );
  });

  test("el pedido de otra persona no se puede ver", async ({ page }) => {
    const order = await createOrderFor((await createTestUser("Otra Persona")).id);
    await loginAsNewUser(page);
    await page.goto(`/pedidos/${order.id}`);
    await expect(page.getByText("No encontramos ese pedido")).toBeVisible();
  });
});
