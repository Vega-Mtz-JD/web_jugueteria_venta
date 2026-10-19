import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { createOrderFor, createProduct, createTestUser, productStock, setOrderStatus } from "./helpers/supabase-admin";

const photo = path.join(__dirname, "fixtures", "captura.png");
const pdf = { name: "manual.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prueba") };

/** Elige una foto; si React aún no hidrató, el onChange no corre: se reintenta. */
async function choosePhoto(page: Page, file: string | typeof pdf, signal: ReturnType<Page["getByText"]>) {
  const input = page.getByLabel("Elegir de la galería");
  await expect(async () => {
    await input.setInputFiles([]);
    await input.setInputFiles(file);
    await expect(signal).toBeVisible({ timeout: 10000 });
  }).toPass({ timeout: 30000 });
}

test.describe("productos en el panel", () => {
  test("crear un producto con foto: aparece en la tienda con su foto", async ({ page }) => {
    const name = `Juego de prueba e2e ${crypto.randomUUID().slice(0, 6)}`;
    await loginAsAdmin(page);
    await page.goto("/panel/productos");
    await page.getByRole("link", { name: "Nuevo producto" }).click();
    await expect(page.getByRole("heading", { name: "Nuevo producto" })).toBeVisible();
    await page.getByLabel("Nombre").fill(name);
    await page.getByRole("combobox", { name: "Categoría", exact: true }).selectOption({ label: "Estrategia" });
    await page.getByLabel("Precio (Bs)", { exact: true }).fill("99");
    await page.getByLabel("Stock inicial").fill("3");
    await page.getByRole("button", { name: "Crear producto" }).click();
    await expect(page).toHaveURL(/\/panel\/productos\/[0-9a-f-]{36}/);
    await expect(page.getByText("Producto creado. Ahora agrégale fotos.")).toBeVisible();

    await choosePhoto(page, photo, page.getByRole("img", { name: "Foto 1" }));

    await page.goto(`/catalogo?q=${encodeURIComponent(name)}`);
    await page.getByRole("link", { name: new RegExp(name) }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("Bs 99", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("img", { name }).first()).toHaveAttribute("src", /product-images/);
  });

  test("cambiar el precio y ocultar se ven enseguida en la tienda", async ({ page }) => {
    const product = await createProduct({ priceCents: 12000 });
    await page.goto(`/producto/${product.slug}`);
    await expect(page.getByText("Bs 120", { exact: true }).first()).toBeVisible();

    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);
    await page.getByLabel("Precio (Bs)", { exact: true }).fill("77");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    await page.goto(`/producto/${product.slug}`);
    await expect(page.getByText("Bs 77", { exact: true }).first()).toBeVisible();

    await page.goto(`/panel/productos/${product.id}`);
    await page.getByLabel("Visible en la tienda").uncheck();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
    await page.goto(`/catalogo?q=${encodeURIComponent(product.name)}`);
    await expect(page.getByRole("link", { name: new RegExp(product.name) })).toHaveCount(0);
  });

  test("borrar: si tiene ventas se oculta; si no, se borra", async ({ page }) => {
    const sold = await createProduct();
    await createOrderFor((await createTestUser("Rosa Mamani")).id, sold.slug);
    const fresh = await createProduct();
    await loginAsAdmin(page);

    await page.goto(`/panel/productos/${sold.id}`);
    await page.getByRole("button", { name: "Borrar producto" }).click();
    await page.getByRole("button", { name: "Sí, borrar" }).click();
    await expect(page.getByText("Se ocultó porque tiene ventas")).toBeVisible();
    await expect(page.getByLabel("Visible en la tienda")).not.toBeChecked();

    await page.goto(`/panel/productos/${fresh.id}`);
    await page.getByRole("button", { name: "Borrar producto" }).click();
    await page.getByRole("button", { name: "Sí, borrar" }).click();
    await expect(page).toHaveURL(/\/panel\/productos\?borrado=1$/);
    await expect(page.getByText("Producto borrado")).toBeVisible();
  });

  test("un PDF como foto avisa y el producto se guarda igual", async ({ page }) => {
    const product = await createProduct();
    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);
    await choosePhoto(page, pdf, page.getByText("Sube una imagen (foto o captura de pantalla)"));
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Cambios guardados")).toBeVisible();
  });

  test("vendí en tienda descuenta, avisa si no alcanza y se puede anular", async ({ page }) => {
    const product = await createProduct({ stock: 3 });
    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);

    await page.getByRole("button", { name: "Vendí" }).click();
    let dialog = page.getByRole("dialog", { name: "Vendí" });
    await expect(dialog.getByLabel("Precio unitario (Bs)")).toHaveValue("100");
    await dialog.getByRole("button", { name: "Registrar venta" }).click();
    await expect(page.getByTestId("stock")).toHaveText("2");
    expect(await productStock(product.slug)).toBe(2);
    await expect(page.getByRole("listitem").filter({ hasText: "Venta en tienda" })).toContainText("−1");

    await page.getByRole("button", { name: "Vendí" }).click();
    dialog = page.getByRole("dialog", { name: "Vendí" });
    await dialog.getByLabel("Cantidad").fill("9");
    await dialog.getByRole("button", { name: "Registrar venta" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("El stock registrado no alcanza (quedan 2 disponibles). Corrige el stock primero");
    await page.keyboard.press("Escape");

    const sale = page.getByRole("listitem").filter({ hasText: "Venta en tienda" });
    await sale.getByRole("button", { name: "Anular" }).click();
    await sale.getByRole("button", { name: "Sí, anular" }).click();
    await expect(page.getByTestId("stock")).toHaveText("3");
    expect(await productStock(product.slug)).toBe(3);
  });

  test("contar estante descuenta lo apartado en pedidos", async ({ page }) => {
    const product = await createProduct({ stock: 2 });
    const order = await createOrderFor((await createTestUser("Rosa Mamani")).id, product.slug);
    await setOrderStatus(order.id, "pagado");
    await loginAsAdmin(page);
    await page.goto(`/panel/productos/${product.id}`);
    await expect(page.getByText("1 apartada en pedidos")).toBeVisible();
    await page.getByRole("button", { name: "Contar estante" }).click();
    const dialog = page.getByRole("dialog", { name: "Contar estante" });
    await dialog.getByLabel("Unidades contadas").fill("4");
    await dialog.getByRole("button", { name: "Guardar conteo" }).click();
    await expect(page.getByTestId("stock")).toHaveText("3");
    expect(await productStock(product.slug)).toBe(3);
  });

  test("la lista muestra stock y apartadas, con + y − rápidos", async ({ page }) => {
    const product = await createProduct({ stock: 3 });
    const order = await createOrderFor((await createTestUser("Rosa Mamani")).id, product.slug);
    await setOrderStatus(order.id, "en_revision");
    await loginAsAdmin(page);
    await page.goto(`/panel/productos?q=${encodeURIComponent(product.name)}`);
    const row = page.getByRole("listitem").filter({ hasText: product.name });
    await expect(row).toContainText("1 apartada");
    await row.getByRole("button", { name: `Sumar una unidad a ${product.name}` }).click();
    await expect(row.getByTestId("stock")).toHaveText("4");
    await row.getByRole("button", { name: `Quitar una unidad a ${product.name}` }).click();
    await expect(row.getByTestId("stock")).toHaveText("3");
    expect(await productStock(product.slug)).toBe(3);
  });
});

test("las listas del panel no se salen de la pantalla del celular", async ({ page }) => {
  await loginAsAdmin(page);
  for (const url of ["/panel/productos", "/panel/pedidos?tab=historial"]) {
    await page.goto(url);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.getByRole("listitem").first().waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, url).toBeLessThanOrEqual(0);
  }
});
