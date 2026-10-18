import { test, expect } from "@playwright/test";

test.describe("auditoría de interfaz", () => {
  test("hay un enlace para saltar al contenido", async ({ page, isMobile }) => {
    test.skip(isMobile, "navegación con teclado");
    await page.goto("/catalogo");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Saltar al contenido" });
    await expect(skip).toBeFocused();
    await skip.press("Enter");
    await expect(page.locator("main#contenido")).toBeFocused();
  });

  test("la portada permite pausar las animaciones", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const cube = page.getByTestId("cube3d");
    const toggle = page.getByRole("button", { name: "Pausar animaciones" });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    const playing = await cube.evaluate((el) => el.getAnimations().filter((a) => a.playState === "running").length);
    expect(playing).toBe(0);
  });

  test("el catálogo tiene meta descripción y color de tema", async ({ page }) => {
    await page.goto("/catalogo");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{20,}/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#f6efe3");
  });
});
