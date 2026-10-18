import { test, expect } from "@playwright/test";

test.describe("cabecera y pie", () => {
  test("en PC muestra el nombre y el enlace al catálogo", async ({ page, isMobile }) => {
    test.skip(isMobile, "solo PC");
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByText("Ludiq")).toBeVisible();
    await header.getByRole("link", { name: "Catálogo", exact: true }).click();
    await expect(page).toHaveURL(/\/catalogo$/);
  });

  test("en celular el menú se abre con un botón", async ({ page, isMobile }) => {
    test.skip(!isMobile, "solo celular");
    await page.goto("/");
    const header = page.getByRole("banner");
    await expect(header.getByRole("link", { name: "Catálogo", exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Abrir menú" }).click();
    await expect(page.getByRole("dialog").getByRole("link", { name: "Catálogo", exact: true })).toBeVisible();
  });

  test("el pie tiene el enlace de WhatsApp de la tienda", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("contentinfo").getByRole("link", { name: /WhatsApp/ });
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/59170000000/);
  });
});
