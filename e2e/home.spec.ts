import { test, expect } from "@playwright/test";

test.describe("página de inicio", () => {
  test("muestra la portada, las 6 categorías y productos destacados", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("pensar");
    await expect(page.getByTestId("category-grid").getByRole("link")).toHaveCount(6);
    expect(await page.getByTestId("featured").getByTestId("product-card").count()).toBeGreaterThanOrEqual(4);
  });

  test("con movimiento reducido el cubo no gira", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const running = await page.getByTestId("cube3d").evaluate((el) => el.getAnimations().length);
    expect(running).toBe(0);
  });

  test("sin movimiento reducido el cubo gira", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const running = await page.getByTestId("cube3d").evaluate((el) => el.getAnimations().length);
    expect(running).toBeGreaterThan(0);
  });

  test("sin fotos la portada muestra el cubo y Visítanos con la dirección", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("cube3d")).toBeVisible();
    await expect(page.getByRole("region", { name: "Fotos de la tienda" })).toHaveCount(0);
    const visit = page.getByRole("region", { name: "Visítanos en La Paz" });
    await expect(visit).toContainText("La Paz, Bolivia");
    await expect(visit.getByRole("link", { name: "Cómo llegar" })).toHaveAttribute("href", /^https:\/\/www\.google\.com\/maps\/search\//);
    await expect(visit.getByRole("button", { name: "Ver el mapa" })).toHaveCount(0);
  });

  test("no hay scroll horizontal", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
