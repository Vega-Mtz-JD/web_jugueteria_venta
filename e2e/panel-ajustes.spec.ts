import path from "node:path";
import { test, expect, type Browser } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { addToCart, loginAsNewUser } from "./helpers/session";
import { adminClient, createOrderFor, createTestUser } from "./helpers/supabase-admin";

// Cambian datos de toda la tienda: una prueba a la vez y solo en PC (playwright.config ignora este archivo en celular).
test.describe.configure({ mode: "serial" });

const SEED = {
  whatsapp_phone: "+59170000000",
  delivery_fee_home_cents: 1500,
};

async function restore() {
  const admin = adminClient();
  await admin.from("store_settings").update(SEED).eq("id", 1);
  await admin.from("delivery_zones").delete().eq("name", "Obrajes");
  await admin.from("meeting_points").update({ is_active: true }).eq("name", "Plaza Murillo");
  await admin.from("payment_methods").update({ qr_path: "/samples/qr-yape.svg" }).eq("name", "Yape");
}

async function customerPage(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  const user = await loginAsNewUser(page, "Ana Compradora");
  return { page, user };
}

test.describe("ajustes del panel", () => {
  test.afterAll(restore);

  test("el WhatsApp nuevo se usa en el pie de la tienda", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/panel/ajustes");
    const store = page.getByRole("region", { name: "Tienda" });
    await store.getByLabel("WhatsApp").fill("+591 7111 2233");
    await store.getByRole("button", { name: "Guardar" }).click();
    await expect(store.getByRole("status")).toHaveText("Guardado");
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/59171112233/);
  });

  test("un QR nuevo de Yape aparece en la página de pago", async ({ page, browser }) => {
    await loginAsAdmin(page);
    await page.goto("/panel/ajustes");
    const yape = page.getByRole("region", { name: "Billeteras QR" }).getByRole("listitem").filter({ has: page.getByLabel("Cambiar QR de Yape") });
    await expect(async () => {
      await yape.getByLabel("Cambiar QR de Yape").setInputFiles([]);
      await yape.getByLabel("Cambiar QR de Yape").setInputFiles(path.join(__dirname, "fixtures", "captura.png"));
      await expect(yape.getByRole("status")).toHaveText("Guardado", { timeout: 8000 });
    }).toPass({ timeout: 30000 });

    const customer = await customerPage(browser);
    const order = await createOrderFor(customer.user.id);
    await customer.page.goto(`/pedidos/${order.id}/pago`);
    await expect(customer.page.getByRole("img", { name: "QR de Yape de la tienda" })).toHaveAttribute("src", /store-assets/);
  });

  test("tarifa, zona nueva y punto desactivado se ven en el checkout", async ({ page, browser }) => {
    await loginAsAdmin(page);
    await page.goto("/panel/ajustes");
    const fees = page.getByRole("region", { name: "Envíos" });
    await fees.getByLabel("Envío a domicilio (Bs)").fill("20");
    await fees.getByRole("button", { name: "Guardar" }).click();
    await expect(fees.getByRole("status")).toHaveText("Guardado");

    const zones = page.getByRole("region", { name: "Zonas" });
    await zones.getByLabel("Nueva zona", { exact: true }).fill("Obrajes");
    await zones.getByLabel("Modo de la nueva zona").selectOption({ label: "A domicilio" });
    await zones.getByRole("button", { name: "Agregar zona" }).click();
    await expect(zones.getByRole("listitem").filter({ has: page.locator('input[value="Obrajes"]') })).toBeVisible();

    const points = page.getByRole("region", { name: "Puntos de encuentro" });
    const murillo = points.getByRole("listitem").filter({ has: page.locator('input[value="Plaza Murillo"]') });
    await murillo.getByLabel("Activo").uncheck();
    await murillo.getByRole("button", { name: "Guardar" }).click();
    await expect(murillo.getByRole("status")).toHaveText("Guardado");

    const { page: buyer } = await customerPage(browser);
    await addToCart(buyer, "uno");
    await buyer.goto("/checkout");
    await buyer.getByRole("radio", { name: /Envío dentro de La Paz/ }).check();
    await buyer.getByLabel("Zona", { exact: true }).selectOption({ label: "Obrajes" });
    await expect(buyer.getByTestId("checkout-summary")).toContainText("Bs 20");
    await buyer.getByLabel("Zona", { exact: true }).selectOption({ label: "El Alto (punto de encuentro)" });
    await expect(buyer.getByRole("radio", { name: /Teleférico Rojo/ })).toBeVisible();
    await expect(buyer.getByRole("radio", { name: /Plaza Murillo/ })).toHaveCount(0);
  });

  test("administradores: agregar por correo, avisos de error y no quitarse a sí mismo", async ({ page, browser }) => {
    const me = await loginAsAdmin(page);
    const helper = await createTestUser("Hijo Ayudante");
    await page.goto("/panel/ajustes");
    const admins = page.getByRole("region", { name: "Administradores" });

    await admins.getByLabel("Correo").fill("nadie-existe@test.bo");
    await admins.getByRole("button", { name: "Agregar administrador" }).click();
    await expect(admins.getByRole("alert")).toHaveText("Esa persona primero debe crear su cuenta en la tienda");

    await admins.getByLabel("Correo").fill(helper.email.toUpperCase());
    await admins.getByRole("button", { name: "Agregar administrador" }).click();
    await expect(admins.getByRole("listitem").filter({ hasText: helper.email })).toBeVisible();

    await admins.getByRole("listitem").filter({ hasText: me.email }).getByRole("button", { name: "Quitar" }).click();
    await expect(admins.getByRole("alert")).toHaveText("No puedes quitarte a ti mismo");

    const helperPage = await (await browser.newContext()).newPage();
    await helperPage.goto("/ingresar");
    await helperPage.getByLabel("Correo").fill(helper.email);
    await helperPage.getByLabel("Contraseña").fill(helper.password);
    await helperPage.getByRole("button", { name: "Ingresar" }).click();
    await helperPage.getByRole("button", { name: /Hijo/ }).click();
    await expect(helperPage.getByRole("menuitem", { name: "Panel" })).toBeVisible();
  });
});
