import { test, expect } from "@playwright/test";

const cards = (page: import("@playwright/test").Page) => page.getByTestId("product-card");

test.describe("catálogo", () => {
  test("muestra todos los productos activos", async ({ page }) => {
    await page.goto("/catalogo");
    await expect(page.getByText("17 juegos")).toBeVisible();
    await expect(cards(page)).toHaveCount(17);
  });

  test("filtra por categoría con las chips", async ({ page }) => {
    await page.goto("/catalogo");
    await page.getByRole("link", { name: "Cartas", exact: true }).click();
    await expect(page).toHaveURL(/categoria=cartas/);
    await expect(page.getByText("3 juegos")).toBeVisible();
    for (const card of await cards(page).all()) await expect(card).toContainText("Cartas");
  });

  test("el buscador encuentra sin tildes", async ({ page }) => {
    await page.goto("/catalogo");
    await page.getByRole("searchbox", { name: "Buscar juegos" }).fill("catan");
    await expect(page).toHaveURL(/q=catan/);
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Catán");
  });

  test("parámetros inválidos no rompen la página", async ({ page }) => {
    const res = await page.goto("/catalogo?precio_min=abc&jugadores=-3&categoria=no-existe");
    expect(res?.status()).toBe(200);
    await expect(page.getByText("No encontramos juegos con esos filtros")).toBeVisible();
  });

  test("el estado vacío permite limpiar los filtros", async ({ page }) => {
    await page.goto("/catalogo?q=zzzz");
    await expect(page.getByText("No encontramos juegos con esos filtros")).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Limpiar filtros" }).first().click();
    await expect(page.getByText("17 juegos")).toBeVisible();
  });

  test("solo ofertas", async ({ page }) => {
    await page.goto("/catalogo?ofertas=1");
    await expect(cards(page)).toHaveCount(1);
    await expect(cards(page).first()).toContainText("Scrabble");
  });

  test("el producto sin fotos usa la imagen de relleno", async ({ page }) => {
    await page.goto("/catalogo?q=4x4");
    await expect(cards(page).first().locator("img")).toHaveAttribute("src", /placeholder\.svg/);
  });

  test("en celular el nombre largo se recorta y no hay scroll horizontal", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo celular");
    await page.goto("/catalogo?categoria=casino");
    const title = cards(page).filter({ hasText: "Ruleta" }).locator("h3");
    await expect(title).toHaveCSS("-webkit-line-clamp", "2");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
