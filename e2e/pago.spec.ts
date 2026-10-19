import path from "node:path";
import { test, expect } from "@playwright/test";
import { chooseProof, loginAsNewUser } from "./helpers/session";
import { createOrderFor, createTestUser, orderStatus } from "./helpers/supabase-admin";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

test.describe("pago con QR", () => {
  test("muestra el código, el total y los QR; sin captura no se envía", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id);
    await page.goto(`/pedidos/${order.id}/pago`);
    await expect(page.getByText(`#${String(order.number).padStart(4, "0")}`).first()).toBeVisible();
    await expect(page.getByText("Bs 35").first()).toBeVisible();
    await expect(page.getByText(/glosa/)).toBeVisible();
    for (const wallet of ["Yape", "Altoke", "Yasta"]) await expect(page.getByRole("tab", { name: wallet })).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar pedido" })).toBeDisabled();
  });

  test("subir la captura deja el pedido en revisión", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id);
    await page.goto(`/pedidos/${order.id}/pago`);
    await chooseProof(page, fixture("captura.png"));
    await expect(page.getByRole("img", { name: "Vista previa de la captura" })).toBeVisible();
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page).toHaveURL(new RegExp(`/pedidos/${order.id}$`), { timeout: 15000 }); // comprime y sube la imagen
    expect(await orderStatus(order.id)).toBe("en_revision");
  });

  test("un PDF se rechaza antes de subirlo", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id);
    await page.goto(`/pedidos/${order.id}/pago`);
    await chooseProof(page, fixture("comprobante.pdf"), false);
    await expect(page.getByText("Sube una imagen (foto o captura de pantalla)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar pedido" })).toBeDisabled();
  });

  test("el pedido de otra persona no se puede ver", async ({ page }) => {
    const other = await createTestUser("Otra Persona");
    const order = await createOrderFor(other.id);
    await loginAsNewUser(page);
    await page.goto(`/pedidos/${order.id}/pago`);
    await expect(page.getByText("No encontramos ese pedido")).toBeVisible();
    await expect(page.getByText("Bs 35")).toHaveCount(0);
  });
});
