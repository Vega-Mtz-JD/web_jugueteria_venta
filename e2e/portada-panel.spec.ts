import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { adminClient, createOrderFor, createProduct, createRawPurchase, createSupplier, createTestUser, setOrderStatus } from "./helpers/supabase-admin";

// Los números suman toda la tienda: estas pruebas comparten la base y corren en orden.
test.describe.configure({ mode: "serial" });

// Los números suman toda la tienda: corre sola, al final (proyecto "portada" en playwright.config).
test("el panel se instala como app", async ({ request }) => {
  const manifest = await (await request.get("/panel.webmanifest")).json();
  expect(manifest).toMatchObject({ start_url: "/panel", scope: "/panel", display: "standalone", short_name: "Panel" });
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
});

/** Ventas de hoy: dos manuales de un juego con costo (3000) y un pedido web de un juego sin costo. */
async function sellToday(ownerId: string) {
  const admin = adminClient();
  await admin.from("orders").delete().not("id", "is", null);
  await admin.from("manual_sales").delete().not("id", "is", null);
  const withCost = await createProduct({ name: `Con costo ${crypto.randomUUID().slice(0, 4)}`, priceCents: 5000, stock: 10 });
  const noCost = await createProduct({ name: `Sin costo ${crypto.randomUUID().slice(0, 4)}`, priceCents: 2000, stock: 10 });
  const { error: ce } = await admin.from("product_costs").insert({ product_id: withCost.id, initial_cost_cents: 3000 });
  if (ce) throw ce;
  const { error } = await admin.from("manual_sales").insert([
    { product_id: withCost.id, quantity: 1, unit_price_cents: 5000, channel: "tienda", created_by: ownerId },
    { product_id: withCost.id, quantity: 1, unit_price_cents: 4500, channel: "whatsapp", created_by: ownerId },
  ]);
  if (error) throw error;
  const customer = await createTestUser("Rosa Mamani");
  const order = await createOrderFor(customer.id, noCost.slug);
  await setOrderStatus(order.id, "en_revision");
  await setOrderStatus(order.id, "pagado");
  return { withCost, noCost, order };
}

test("la lista de ventas cuadra con sus totales", async ({ page }) => {
  const owner = await loginAsAdmin(page);
  const { withCost, noCost, order } = await sellToday(owner.id);

  await page.goto("/panel/mas");
  await page.getByRole("link", { name: /Ventas/ }).click();
  await expect(page).toHaveURL(/\/panel\/ventas$/);
  await expect(page.getByRole("heading", { name: "Ventas", level: 1 })).toBeVisible();

  await page.goto("/panel/ventas?periodo=hoy");
  const totals = page.getByRole("region", { name: "Totales" });
  await expect(totals).toContainText("Vendiste Bs 115");
  await expect(totals).toContainText("3 ventas · 3 juegos");
  await expect(totals).toContainText("Te costaron Bs 60");
  await expect(totals).toContainText("Ganancia Bs 35");
  await expect(totals).toContainText("Sin costo anotado Bs 20");
  const list = page.getByRole("list", { name: "Ventas" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  await expect(list.getByRole("listitem").filter({ hasText: noCost.name })).toContainText("sin costo");
  await expect(list.getByRole("listitem").filter({ hasText: "Tienda" })).toContainText(withCost.name);

  await page.getByRole("link", { name: "Tienda", exact: true }).click();
  await expect(page).toHaveURL(/canal=tienda/);
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(totals).toContainText("Vendiste Bs 50");

  await page.getByRole("link", { name: "Todos", exact: true }).click();
  await expect(page).not.toHaveURL(/canal=/);
  await page.getByRole("link", { name: "Solo sin costo" }).click();
  await expect(page).toHaveURL(/sincosto=1/);
  await expect(list.getByRole("listitem")).toHaveCount(1);
  await expect(totals).toContainText("Vendiste Bs 20");

  await list.getByRole("link", { name: new RegExp(`Pedido #0*${order.number}$`) }).click();
  await expect(page).toHaveURL(new RegExp(`/panel/pedidos/${order.id}`));
});

async function clearSalesAndPurchases() {
  const admin = adminClient();
  await admin.from("orders").delete().not("id", "is", null);
  await admin.from("manual_sales").delete().not("id", "is", null);
  await admin.from("purchase_payments").delete().not("id", "is", null);
  await admin.from("purchases").delete().not("id", "is", null);
}

test("la portada muestra la ganancia y lleva a la lista que la forma", async ({ page }) => {
  const owner = await loginAsAdmin(page);
  await sellToday(owner.id);

  await page.goto("/panel?periodo=hoy");
  const profit = page.getByRole("region", { name: "Ganancia" });
  await expect(profit).toContainText("Bs 35");
  await expect(profit).toContainText("Bs 20 en ventas sin costo anotado");
  await expect(profit).toContainText("Vendiste Bs 115 (3 ventas, 3 juegos)");

  await profit.getByRole("link", { name: /^Ganaste hoy/ }).click();
  await expect(page).toHaveURL(/\/panel\/ventas\?periodo=hoy$/);
  await expect(page.getByRole("region", { name: "Totales" })).toContainText("Ganancia Bs 35");

  await page.goto("/panel?periodo=hoy");
  await profit.getByRole("link", { name: /de ganancia$/ }).last().click();
  await expect(page).toHaveURL(/\/panel\/ventas\?desde=\d{4}-\d{2}-\d{2}&hasta=\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByRole("region", { name: "Totales" })).toContainText("Ganancia Bs 35");
});

test("la portada muestra lo pendiente y qué volver a comprar", async ({ page }) => {
  const owner = await loginAsAdmin(page);
  await clearSalesAndPurchases();
  const admin = adminClient();
  const customer = await createTestUser("Rosa Mamani");
  await setOrderStatus((await createOrderFor(customer.id, "uno")).id, "en_revision");
  const supplier = await createSupplier({ whatsapp: "71234567" });
  const purchaseId = await createRawPurchase(supplier.id);
  const cheap = await createProduct({ name: `Barato ${crypto.randomUUID().slice(0, 4)}`, priceCents: 1000, stock: 1 });
  const pricey = await createProduct({ name: `Caro ${crypto.randomUUID().slice(0, 4)}`, priceCents: 20000, stock: 5 });
  const { error: pe } = await admin.from("purchase_items").insert({ purchase_id: purchaseId, product_id: cheap.id, quantity_ordered: 1, unit_price_cents: 5000 });
  if (pe) throw pe;
  const { error } = await admin.from("manual_sales").insert([
    { product_id: cheap.id, quantity: 3, unit_price_cents: 1000, channel: "tienda", created_by: owner.id },
    { product_id: pricey.id, quantity: 1, unit_price_cents: 20000, channel: "tienda", created_by: owner.id },
  ]);
  if (error) throw error;

  await page.goto("/panel");
  const pending = page.getByRole("region", { name: "Pendiente" });
  await expect(pending.getByRole("link", { name: /Por revisar/ })).toContainText("1");
  await expect(pending.getByRole("link", { name: /Compras por llegar/ })).toContainText("1");
  await expect(pending.getByRole("link", { name: /Debes a proveedores/ })).toContainText("Bs 50");

  const restock = page.getByRole("region", { name: "Qué volver a comprar" });
  await expect(restock.getByRole("list", { name: "Se está agotando" }).getByRole("listitem").first()).toContainText(cheap.name);
  const top = restock.getByRole("list", { name: "Lo más vendido" }).getByRole("listitem");
  await expect(top.first()).toContainText(cheap.name);
  await restock.getByRole("button", { name: "Ingresos" }).click();
  await expect(top.first()).toContainText(pricey.name);

  await restock.getByRole("link", { name: /Ver poco stock/ }).click();
  await expect(page).toHaveURL(/\/panel\/productos\?filtro=poco-stock$/);
});

test("sin ventas la portada no se rompe", async ({ page }) => {
  await loginAsAdmin(page);
  await clearSalesAndPurchases();
  await page.goto("/panel?periodo=mes-anterior");
  const profit = page.getByRole("region", { name: "Ganancia" });
  await expect(profit).toContainText("Bs 0");
  await expect(profit).toContainText("Sin ventas en");
  await expect(page.getByRole("region", { name: "Inventario" })).toBeVisible();
  await expect(page.locator('[style*="NaN"]')).toHaveCount(0);
});

test("en el celular no hay desborde y en la PC usa dos columnas", async ({ page }) => {
  const owner = await loginAsAdmin(page);
  await sellToday(owner.id);
  await page.goto("/panel");
  await expect(page.getByRole("region", { name: "Ganancia" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.setViewportSize({ width: 1280, height: 800 });
  const left = await page.getByRole("region", { name: "Ganancia" }).boundingBox();
  const right = await page.getByRole("region", { name: "Inventario" }).boundingBox();
  expect(left && right && right.x >= left.x + left.width).toBe(true);
});
