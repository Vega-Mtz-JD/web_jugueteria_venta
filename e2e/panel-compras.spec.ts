import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { adminClient, createProduct, createSupplier } from "./helpers/supabase-admin";

type Line = { product?: string; newGame?: string; quantity: string; price: string };

/** Llena "Nueva compra" y la guarda; devuelve el id de la compra. */
async function newPurchase(page: Page, o: { supplier: string; currency?: "Bolivianos" | "Dólares"; lines: Line[]; advance?: { amount: string; currency?: "Bolivianos" | "Dólares"; rate?: string } }) {
  await page.goto("/panel/compras/nueva");
  await page.getByRole("combobox", { name: "Proveedor" }).selectOption({ label: o.supplier });
  if (o.currency) await page.getByRole("radio", { name: o.currency }).check();
  for (const [i, l] of o.lines.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Agregar otro producto" }).click();
    const row = page.getByRole("group", { name: `Producto ${i + 1}` });
    if (l.newGame) {
      await row.getByRole("checkbox", { name: "Es un juego nuevo" }).check();
      await row.getByLabel("Nombre del juego nuevo").fill(l.newGame);
      await row.getByRole("combobox", { name: "Categoría del juego nuevo" }).selectOption({ label: "Estrategia" });
    } else {
      await row.getByRole("combobox", { name: "Producto" }).selectOption({ label: l.product! });
    }
    await row.getByLabel("Cantidad").fill(l.quantity);
    await row.getByLabel("Precio por unidad").fill(l.price);
  }
  if (o.advance) {
    const adv = page.getByRole("group", { name: "Adelanto (opcional)" });
    await adv.getByLabel("Monto del adelanto").fill(o.advance.amount);
    if (o.advance.currency) await adv.getByRole("combobox", { name: "Moneda del adelanto" }).selectOption({ label: o.advance.currency });
    if (o.advance.rate) await adv.getByLabel("A cuánto estaba el dólar").fill(o.advance.rate);
  }
  await page.getByRole("button", { name: "Guardar compra" }).click();
  await expect(page).toHaveURL(/\/panel\/compras\/[0-9a-f-]{36}$/);
  return page.url().split("/").at(-1)!;
}

const isAction = (r: { method(): string; headers(): Record<string, string> }) => r.method() === "POST" && "next-action" in r.headers();

test.describe("compras en el panel", () => {
  test("encargo con juego nuevo y adelanto, llegada con envío y pago del saldo", async ({ page }) => {
    const supplier = await createSupplier();
    const game = `Juego encargado e2e ${crypto.randomUUID().slice(0, 6)}`;
    await loginAsAdmin(page);
    await newPurchase(page, { supplier: supplier.name, lines: [{ newGame: game, quantity: "3", price: "100" }], advance: { amount: "100" } });

    await page.goto("/panel/compras");
    await expect(page.getByRole("region", { name: "Lo que falta llegar" })).toContainText(supplier.name);
    await expect(page.getByRole("region", { name: "Lo que debo" }).getByRole("listitem").filter({ hasText: supplier.name })).toContainText("Bs 200");
    await page.goto(`/catalogo?q=${encodeURIComponent(game)}`);
    await expect(page.getByRole("link", { name: new RegExp(game) })).toHaveCount(0);

    await page.goto("/panel/compras");
    await page.getByRole("region", { name: "Lo que falta llegar" }).getByRole("listitem").filter({ hasText: supplier.name }).getByRole("link", { name: "Llegó" }).click();
    const dialog = page.getByRole("dialog", { name: "Llegó la compra" });
    await expect(dialog.getByLabel(`Llegaron de «${game}»`)).toHaveValue("3");
    await dialog.getByLabel("Costo de la encomienda (Bs)").fill("30");
    await dialog.getByRole("checkbox", { name: "Pagar el saldo ahora" }).check();
    await expect(dialog.getByLabel("Monto del saldo")).toHaveValue("200");
    await dialog.getByRole("button", { name: "Guardar llegada" }).click();

    await expect(page.getByTestId("purchase-status")).toHaveText("Recibida");
    await expect(page.getByRole("listitem").filter({ hasText: game })).toContainText("Bs 110 c/u");
    const { data } = await adminClient().from("products").select("stock, is_active").eq("name", game).single();
    expect(data).toEqual({ stock: 3, is_active: false });

    await page.goto("/panel/compras");
    await expect(page.getByRole("region", { name: "Lo que falta llegar" })).not.toContainText(supplier.name);
    await expect(page.getByRole("region", { name: "Lo que debo" })).not.toContainText(supplier.name);
    await page.goto(`/catalogo?q=${encodeURIComponent(game)}`);
    await expect(page.getByRole("link", { name: new RegExp(game) })).toHaveCount(0);
  });

  test("compra en dólares con adelanto: lo que debo en US$", async ({ page }) => {
    const supplier = await createSupplier();
    const product = await createProduct();
    await loginAsAdmin(page);
    await newPurchase(page, {
      supplier: supplier.name,
      currency: "Dólares",
      lines: [{ product: product.name, quantity: "2", price: "10" }],
      advance: { amount: "10", currency: "Dólares", rate: "6,96" },
    });
    await page.goto("/panel/compras");
    await expect(page.getByRole("region", { name: "Lo que debo" }).getByRole("listitem").filter({ hasText: supplier.name })).toContainText("US$ 10");
  });

  test("un pago con la respuesta perdida no se registra dos veces; con pagos no se anula", async ({ page }) => {
    const supplier = await createSupplier();
    const product = await createProduct();
    await loginAsAdmin(page);
    const id = await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "50" }] });

    await page.getByRole("button", { name: "Registrar pago" }).click();
    const dialog = page.getByRole("dialog", { name: "Registrar pago" });
    await dialog.getByLabel("Monto", { exact: true }).fill("20");
    await page.route("**/*", async (route) => {
      if (!isAction(route.request())) return route.continue();
      await route.fetch();
      await route.abort("internetdisconnected");
    });
    await dialog.getByRole("button", { name: "Guardar pago" }).click();
    await expect(dialog.getByRole("alert")).toContainText("No pudimos conectar");
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await dialog.getByRole("button", { name: "Guardar pago" }).click();
    await expect(dialog).toBeHidden();
    const { data: pays } = await adminClient().from("purchase_payments").select("id").eq("purchase_id", id);
    expect(pays).toHaveLength(1);

    await page.getByRole("button", { name: "Anular compra" }).click();
    await page.getByRole("button", { name: "Sí, anular" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Primero anula los pagos de esta compra" })).toBeVisible();
  });

  test("saldo a favor: se usa en otra compra del mismo proveedor", async ({ page }) => {
    const supplier = await createSupplier();
    const product = await createProduct();
    await loginAsAdmin(page);
    const second = await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "5" }] });
    const first = await newPurchase(page, { supplier: supplier.name, lines: [{ product: product.name, quantity: "1", price: "10" }], advance: { amount: "12" } });

    await expect(page.getByTestId("purchase-balance")).toContainText("Saldo a favor: Bs 2");
    await page.getByRole("button", { name: "Usar en otra compra" }).click();
    const dialog = page.getByRole("dialog", { name: "Usar el saldo en otra compra" });
    await dialog.getByRole("combobox", { name: "Compra destino" }).selectOption({ value: second });
    await dialog.getByRole("button", { name: "Usar saldo" }).click();
    await expect(page.getByTestId("purchase-balance")).toContainText("Al día");
    await page.goto(`/panel/compras/${second}`);
    await expect(page.getByTestId("purchase-balance")).toContainText("Se debe: Bs 3");
    expect(first).not.toBe(second);
  });
});
