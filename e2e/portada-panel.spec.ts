import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { adminClient, createOrderFor, createProduct, createTestUser, productId, setOrderStatus } from "./helpers/supabase-admin";

// Los números suman toda la tienda: estas pruebas comparten la base y corren en orden.
test.describe.configure({ mode: "serial" });

// Los números suman toda la tienda: corre sola, al final (proyecto "portada" en playwright.config).
test("la portada muestra pedidos por revisar, ventas de hoy y poco stock", async ({ page, request }) => {
  const admin = adminClient();
  await admin.from("orders").delete().not("id", "is", null);
  await admin.from("manual_sales").delete().not("id", "is", null);

  const owner = await loginAsAdmin(page);
  const customer = await createTestUser("Rosa Mamani");
  const review = await createOrderFor(customer.id, "uno");
  await setOrderStatus(review.id, "en_revision");
  const paid = await createOrderFor(customer.id, "catan");
  await setOrderStatus(paid.id, "pagado");
  const { error } = await admin
    .from("manual_sales")
    .insert({ product_id: await productId("uno"), quantity: 1, unit_price_cents: 3500, channel: "tienda", created_by: owner.id });
  if (error) throw error;

  await page.goto("/panel");
  await expect(page.getByRole("link", { name: /Por revisar/ })).toContainText("1");
  const today = page.getByRole("region", { name: "Ventas de hoy" });
  await expect(today).toContainText("Bs 485");
  await expect(today).toContainText("2 ventas");
  await expect(page.getByRole("link", { name: /Por entregar/ })).toContainText("1");

  await page.getByRole("link", { name: /Poco stock/ }).click();
  await expect(page).toHaveURL(/\/panel\/productos\?filtro=poco-stock$/);
  await expect(page.getByRole("link", { name: /Jenga/ })).toBeVisible(); // seed: Jenga tiene 2

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
