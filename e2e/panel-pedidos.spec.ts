import { test, expect, type Browser, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { loginAsNewUser } from "./helpers/session";
import { createOrderFor, createProduct, createTestUser, productStock, setOrderFields, setOrderStatus } from "./helpers/supabase-admin";

const code = (n: number) => `#${String(n).padStart(4, "0")}`;
const ENCOMIENDA = { delivery_method: "encomienda", recipient_ci: "4567890", department: "Oruro", city: "Oruro" };

/** El comprador en su propio navegador (otra sesión). */
async function customerSession(browser: Browser): Promise<{ page: Page; id: string }> {
  const page = await (await browser.newContext()).newPage();
  const user = await loginAsNewUser(page, "Ana Compradora");
  return { page, id: user.id };
}

test.describe("pedidos en el panel", () => {
  test("por revisar lista los pedidos y destaca los de más de 24 horas", async ({ page }) => {
    const customer = await createTestUser("Rosa Mamani");
    const fresh = await createOrderFor(customer.id);
    const old = await createOrderFor(customer.id);
    await setOrderStatus(fresh.id, "en_revision");
    await setOrderStatus(old.id, "en_revision");
    await setOrderFields(old.id, { status_changed_at: new Date(Date.now() - 25 * 3600_000).toISOString() });
    await loginAsAdmin(page);
    await page.goto("/panel/pedidos");
    await expect(page.getByRole("link", { name: new RegExp(code(fresh.number)) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(code(old.number)) })).toContainText("Hace más de 24 h");
    await expect(page.getByRole("link", { name: new RegExp(code(fresh.number)) })).not.toContainText("Hace más de 24 h");
  });

  test("confirmar el pago lo pasa a por entregar", async ({ page }) => {
    const customer = await createTestUser("Rosa Mamani");
    const order = await createOrderFor(customer.id);
    await setOrderStatus(order.id, "en_revision");
    await loginAsAdmin(page);
    await page.goto(`/panel/pedidos/${order.id}`);
    await expect(page.getByText(code(order.number)).first()).toBeVisible();
    await page.getByRole("button", { name: "Confirmar pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Pagado");
    await page.goto("/panel/pedidos?tab=entregar");
    await expect(page.getByRole("link", { name: new RegExp(code(order.number)) })).toBeVisible();
  });

  test("rechazar con un motivo rápido: el comprador lo ve", async ({ page, browser }) => {
    const customer = await customerSession(browser);
    const order = await createOrderFor(customer.id);
    await setOrderStatus(order.id, "en_revision");
    await loginAsAdmin(page);
    await page.goto(`/panel/pedidos/${order.id}`);
    await page.getByRole("button", { name: "Rechazar" }).click();
    const dialog = page.getByRole("dialog", { name: "Rechazar el pago" });
    await dialog.getByRole("button", { name: "Monto incorrecto" }).click();
    await expect(dialog.getByLabel("Motivo")).toHaveValue("Monto incorrecto");
    await dialog.getByRole("button", { name: "Rechazar pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Rechazado");

    await customer.page.goto(`/pedidos/${order.id}`);
    await expect(customer.page.getByText("Motivo: Monto incorrecto")).toBeVisible();
  });

  test("encomienda: enviar pide agencia y guía, y el comprador las ve", async ({ page, browser }) => {
    const customer = await customerSession(browser);
    const order = await createOrderFor(customer.id, "uno", ENCOMIENDA);
    await setOrderStatus(order.id, "pagado");
    await loginAsAdmin(page);
    await page.goto(`/panel/pedidos/${order.id}`);
    await page.getByRole("button", { name: "Marcar como enviado" }).click();
    const dialog = page.getByRole("dialog", { name: "Marcar como enviado" });
    await dialog.getByRole("button", { name: "Guardar envío" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Escribe la agencia y el número de guía");
    await dialog.getByLabel("Agencia").fill("Trans Copacabana");
    await dialog.getByLabel("Número de guía").fill("G-555");
    await dialog.getByRole("button", { name: "Guardar envío" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Enviado");

    await customer.page.goto(`/pedidos/${order.id}`);
    await expect(customer.page.getByText("Enviado por")).toContainText("Trans Copacabana · Guía G-555");
  });

  test("reembolsar un pedido pagado devuelve el stock", async ({ page }) => {
    const customer = await createTestUser("Rosa Mamani");
    const product = await createProduct({ stock: 2 });
    const order = await createOrderFor(customer.id, product.slug);
    await setOrderStatus(order.id, "pagado");
    const before = await productStock(product.slug);
    await loginAsAdmin(page);
    await page.goto(`/panel/pedidos/${order.id}`);
    await page.getByRole("button", { name: "Reembolsar" }).click();
    await page.getByRole("button", { name: "Sí, reembolsar" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Reembolsado");
    expect(await productStock(product.slug)).toBe(before + 1);
  });

  test("dos pestañas: la segunda acción avisa que el pedido ya cambió", async ({ page, context }) => {
    const customer = await createTestUser("Rosa Mamani");
    const order = await createOrderFor(customer.id);
    await setOrderStatus(order.id, "en_revision");
    await loginAsAdmin(page);
    const other = await context.newPage();
    await page.goto(`/panel/pedidos/${order.id}`);
    await other.goto(`/panel/pedidos/${order.id}`);

    await page.getByRole("button", { name: "Confirmar pago" }).click();
    await expect(page.getByTestId("order-status")).toHaveText("Pagado");

    await other.getByRole("button", { name: "Rechazar" }).click();
    const dialog = other.getByRole("dialog", { name: "Rechazar el pago" });
    await dialog.getByRole("button", { name: "No se ve el pago" }).click();
    await dialog.getByRole("button", { name: "Rechazar pago" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Este pedido ya cambió; recarga la página");
  });

  test("el enlace de WhatsApp al cliente lleva el código del pedido", async ({ page }) => {
    const customer = await createTestUser("Rosa Mamani");
    const order = await createOrderFor(customer.id);
    await setOrderStatus(order.id, "en_revision");
    await loginAsAdmin(page);
    await page.goto(`/panel/pedidos/${order.id}`);
    const link = page.getByRole("link", { name: "Escribir al cliente por WhatsApp" });
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/59171234567\?text=/);
    await expect(link).toHaveAttribute("href", new RegExp(encodeURIComponent(code(order.number))));
  });
});
