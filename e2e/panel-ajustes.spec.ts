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

async function clearStorePhotos() {
  const admin = adminClient();
  await admin.from("store_photos").delete().not("id", "is", null);
  const { data } = await admin.storage.from("product-images").list("tienda");
  if (data?.length) await admin.storage.from("product-images").remove(data.map((f) => `tienda/${f.name}`));
}

async function restore() {
  const admin = adminClient();
  await admin.from("store_settings").update({ ...SEED, zone: null, maps_url: null, latitude: null, longitude: null }).eq("id", 1);
  await clearStorePhotos();
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

  test("el dueño sube, ordena y quita fotos de la tienda", async ({ page }) => {
    await clearStorePhotos();
    await loginAsAdmin(page);
    await page.goto("/panel/ajustes");
    const photos = page.getByRole("region", { name: "Fotos de la tienda" });
    const file = path.join(__dirname, "fixtures", "captura.png");

    await photos.getByLabel("Elegir foto").setInputFiles(file);
    await photos.getByRole("button", { name: "Subir foto" }).click();
    await expect(photos.getByRole("alert")).toHaveText("Escribe una frase corta");

    for (const caption of ["Nuestra vitrina", "El Illimani desde la tienda"]) {
      await photos.getByLabel("Elegir foto").setInputFiles(file);
      await photos.getByLabel("Frase", { exact: true }).fill(caption);
      await photos.getByRole("button", { name: "Subir foto" }).click();
      await expect(photos.getByRole("list", { name: "Fotos subidas" }).getByRole("textbox").last()).toHaveValue(caption);
    }
    const captions = photos.getByRole("list", { name: "Fotos subidas" }).getByRole("textbox");
    await expect(captions).toHaveCount(2);
    await expect(captions.nth(0)).toHaveValue("Nuestra vitrina");

    await photos.getByRole("button", { name: "Mover arriba: El Illimani desde la tienda" }).click();
    await expect(captions.nth(0)).toHaveValue("El Illimani desde la tienda");
    await expect(captions.nth(1)).toHaveValue("Nuestra vitrina");

    for (const caption of ["Nuestra vitrina", "El Illimani desde la tienda"]) {
      const item = photos.getByRole("listitem").filter({ has: page.getByRole("textbox", { name: `Frase de «${caption}»` }) });
      await item.getByRole("button", { name: "Quitar" }).click();
      await item.getByRole("button", { name: "Sí, quitar" }).click();
      await expect(item).toHaveCount(0);
    }
    await expect(photos.getByText("Todavía no hay fotos.")).toBeVisible();
    const { data: files } = await adminClient().storage.from("product-images").list("tienda");
    expect(files ?? []).toHaveLength(0);
  });

  test("el dueño guarda la ubicación de la tienda", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/panel/ajustes");
    const store = page.getByRole("region", { name: "Tienda", exact: true });
    const save = async () => store.getByRole("button", { name: "Guardar" }).click();

    await store.getByLabel("Coordenadas").fill("abc");
    await save();
    await expect(store.getByRole("alert")).toHaveText("Pega las coordenadas como aparecen en Google Maps, por ejemplo -16.5103, -68.1267");

    await store.getByLabel("Coordenadas").fill("-16.5103, -68.1267");
    await store.getByLabel("Enlace de Google Maps").fill("https://evil.example/maps");
    await save();
    await expect(store.getByRole("alert")).toHaveText("Pega el enlace de Google Maps que mandas por WhatsApp");

    await store.getByLabel("Enlace de Google Maps").fill("https://maps.app.goo.gl/AbC123");
    await store.getByLabel("Zona (ej.: Sopocachi)").fill("Sopocachi");
    await save();
    await expect(store.getByRole("status")).toHaveText("Guardado");

    await page.reload();
    await expect(store.getByLabel("Coordenadas")).toHaveValue("-16.5103, -68.1267");
    await expect(store.getByLabel("Enlace de Google Maps")).toHaveValue("https://maps.app.goo.gl/AbC123");
    await expect(store.getByLabel("Zona (ej.: Sopocachi)")).toHaveValue("Sopocachi");
  });

  test("borrar una billetera pide confirmación (un toque de más no quita el QR)", async ({ page }) => {
    const admin = adminClient();
    const { error } = await admin.from("payment_methods").insert({ name: "Billetera e2e", qr_path: "/samples/qr-yape.svg", sort_order: 99 });
    if (error) throw error;
    try {
      await loginAsAdmin(page);
      await page.goto("/panel/ajustes");
      const wallet = page.getByRole("region", { name: "Billeteras QR" }).getByRole("listitem").filter({ has: page.getByLabel("Cambiar QR de Billetera e2e") });
      await wallet.getByRole("button", { name: "Borrar" }).click();
      await expect(wallet.getByRole("button", { name: "Sí, borrar" })).toBeVisible();
      await wallet.getByRole("button", { name: "No" }).click();
      await page.reload();
      await expect(page.getByLabel("Cambiar QR de Billetera e2e")).toBeAttached();
      const again = page.getByRole("region", { name: "Billeteras QR" }).getByRole("listitem").filter({ has: page.getByLabel("Cambiar QR de Billetera e2e") });
      await again.getByRole("button", { name: "Borrar" }).click();
      await again.getByRole("button", { name: "Sí, borrar" }).click();
      await expect(page.getByLabel("Cambiar QR de Billetera e2e")).toHaveCount(0);
    } finally {
      await admin.from("payment_methods").delete().eq("name", "Billetera e2e");
    }
  });

  test("el WhatsApp nuevo se usa en el pie de la tienda", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/panel/ajustes");
    const store = page.getByRole("region", { name: "Tienda" });
    await store.getByLabel("WhatsApp").fill("+591 7111 2233");
    await store.getByRole("button", { name: "Guardar" }).click();
    await expect(store.getByRole("status")).toHaveText("Guardado");
    // Unos segundos de margen: una regeneración de la portada que empezó antes de guardar (al ingresar)
    // puede terminar después; invalidateCatalog la vuelve a invalidar a los 3 s.
    await expect(async () => {
      await page.goto("/");
      await expect(page.getByRole("contentinfo").getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/59171112233/, { timeout: 1000 });
    }).toPass({ timeout: 15000 });
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

    const mine = admins.getByRole("listitem").filter({ hasText: me.email });
    await mine.getByRole("button", { name: "Quitar" }).click();
    await mine.getByRole("button", { name: "Sí, quitar" }).click();
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
