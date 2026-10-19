import path from "node:path";
import { test, expect } from "@playwright/test";
import { addToCart, chooseProof, loginAsNewUser } from "./helpers/session";
import { createOrderFor, createTestUser, makeAdmin, ordersOf, setOrderStatus } from "./helpers/supabase-admin";

test.describe("correcciones de la revisión del plan 2", () => {
  test("#9: la cuenta del dueño ve en «Mis pedidos» solo sus propios pedidos", async ({ page }) => {
    const other = await createTestUser("Otra Persona");
    await createOrderFor(other.id);
    const owner = await loginAsNewUser(page, "Dueño Tienda");
    await makeAdmin(owner.id);
    await page.goto("/pedidos");
    await expect(page.getByText("Todavía no hiciste pedidos")).toBeVisible();
  });

  test("#5: un enlace de correo que cae en la página de inicio se procesa igual", async ({ page }) => {
    await page.goto("/?token_hash=enlace-viejo&type=email");
    await expect(page).toHaveURL(/\/ingresar\?error=enlace$/);
    await expect(page.getByText("El enlace venció o ya se usó")).toBeVisible();
  });

  test("#3: el pago muestra el plazo y avisa claro si el pedido venció", async ({ page }) => {
    const user = await loginAsNewUser(page);
    const order = await createOrderFor(user.id);
    await page.goto(`/pedidos/${order.id}/pago`);
    await expect(page.getByText(/Sube la captura antes de las \d{1,2}:\d{2}/)).toBeVisible();
    await setOrderStatus(order.id, "cancelado");
    await chooseProof(page, path.join(__dirname, "fixtures", "captura.png"));
    await page.getByRole("button", { name: "Enviar pedido" }).click();
    await expect(page.getByText(/Tu pedido venció/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("link", { name: /Escribir por WhatsApp/ })).toHaveAttribute("href", /wa\.me/);
  });

  test("#4: si se pierde la respuesta, reintentar o recargar no crea otro pedido", async ({ page }) => {
    const user = await loginAsNewUser(page);
    await addToCart(page, "uno");
    await page.goto("/checkout");
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Recojo en tienda/ }).check();
    // La primera vez el servidor crea el pedido pero la respuesta no llega al navegador.
    let dropped = false;
    await page.route("**/checkout", async (route) => {
      if (!dropped && route.request().method() === "POST") {
        dropped = true;
        await route.fetch();
        await route.abort("connectionreset");
        return;
      }
      await route.continue();
    });
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page.getByText(/No pudimos confirmar tu pedido/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Continuar al pago" })).toBeEnabled();
    await page.reload();
    await page.getByLabel("Celular").fill("71234567");
    await page.getByRole("radio", { name: /Recojo en tienda/ }).check();
    await page.getByRole("button", { name: "Continuar al pago" }).click();
    await expect(page).toHaveURL(/\/pedidos\/[0-9a-f-]{36}\/pago$/);
    expect(await ordersOf(user.id)).toHaveLength(1);
  });
});
