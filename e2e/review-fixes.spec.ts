import { test, expect } from "@playwright/test";

test.describe("correcciones de la revisión final", () => {
  test("C1: escribir lento en el buscador no pierde letras ni el foco", async ({ page }) => {
    await page.goto("/catalogo");
    const search = page.getByRole("searchbox", { name: "Buscar juegos" });
    await search.click();
    await search.pressSequentially("monopolio", { delay: 350 });
    await expect(page).toHaveURL(/q=monopolio/);
    await expect(search).toHaveValue("monopolio");
    await expect(search).toBeFocused();
    await expect(page.getByTestId("product-card")).toHaveCount(1);
  });

  test("C1: pasar del precio mínimo al máximo no borra lo escrito", async ({ page, isMobile }) => {
    test.skip(isMobile, "los filtros de precio en celular están dentro del panel");
    await page.goto("/catalogo");
    const min = page.getByRole("spinbutton", { name: "Precio mínimo" });
    const max = page.getByRole("spinbutton", { name: "Precio máximo" });
    await min.click();
    await min.pressSequentially("100", { delay: 100 });
    await max.click();
    await max.pressSequentially("200", { delay: 350 });
    await expect(max).toHaveValue("200");
    await max.press("Enter");
    await expect(page).toHaveURL(/precio_min=100&precio_max=200/);
  });

  test("I1: el título de la portada llega visible en el HTML del servidor", async ({ request }) => {
    const html = await (await request.get("/")).text();
    expect(html).not.toMatch(/opacity:\s*0/);
  });

  test("I2: con movimiento reducido la portada no tiene errores de hidratación", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });

  test("M3: el carrito no lleva a un 404", async ({ page }) => {
    const res = await page.goto("/carrito");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("carrito");
    await expect(page.getByRole("link", { name: "Ver catálogo" })).toBeVisible();
  });
});
