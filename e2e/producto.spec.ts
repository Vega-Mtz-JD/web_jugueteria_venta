import { test, expect } from "@playwright/test";

test.describe("ficha de producto", () => {
  test("muestra nombre, precio y consulta por WhatsApp", async ({ page }) => {
    await page.goto("/producto/catan");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Catán");
    await expect(page.getByText("Bs 450", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Consultar por WhatsApp" })).toHaveAttribute(
      "href",
      /text=Hola%2C%20consulto%20por%20el%20producto/,
    );
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Catán/);
  });

  test("un producto agotado no se puede agregar", async ({ page }) => {
    await page.goto("/producto/exploding-kittens");
    await expect(page.getByRole("button", { name: "Agotado" })).toBeDisabled();
  });

  test("avisa cuando quedan pocas unidades", async ({ page }) => {
    await page.goto("/producto/jenga");
    await expect(page.getByText("Últimas 2 unidades")).toBeVisible();
  });

  test("sugiere otros juegos de la misma categoría", async ({ page }) => {
    await page.goto("/producto/catan");
    const related = page.getByTestId("related").getByTestId("product-card");
    await expect(related).toHaveCount(2);
    await expect(related.filter({ hasText: "Catán" })).toHaveCount(0);
  });

  for (const slug of ["risk", "no-existe"]) {
    // Si la ruta no se generó en el build, Next ya envió el 200 al empezar el streaming;
    // en ese caso marca la página con noindex (ver docs de Next: streaming › Status codes).
    test(`/${slug} muestra la página "no disponible" y no se indexa`, async ({ page }) => {
      const res = await page.goto(`/producto/${slug}`);
      await expect(page.getByRole("heading", { name: "Este juego ya no está disponible" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver catálogo" })).toBeVisible();
      if (res?.status() !== 404) {
        expect(res?.status()).toBe(200);
        expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBeGreaterThan(0);
      }
    });
  }
});
