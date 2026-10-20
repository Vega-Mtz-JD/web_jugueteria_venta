import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { adminClient, createOrderFor, createTestUser, productId, setOrderStatus } from "./helpers/supabase-admin";

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
