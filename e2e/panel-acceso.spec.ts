import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { loginAsNewUser } from "./helpers/session";

test.describe("acceso al panel", () => {
  test("sin sesión manda a ingresar", async ({ page }) => {
    await page.goto("/panel");
    await expect(page).toHaveURL(/\/ingresar\?siguiente=%2Fpanel$/);
  });

  test("un cliente común no ve el panel", async ({ page }) => {
    await loginAsNewUser(page);
    await page.getByRole("button", { name: /Ana/ }).click();
    await expect(page.getByRole("menuitem", { name: "Mis pedidos" })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: "Panel" })).toHaveCount(0);
    await page.goto("/panel");
    await expect(page.getByRole("heading", { name: "No encontramos esta página" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Panel" })).toHaveCount(0);
  });

  test("un administrador entra desde su menú y ve la navegación", async ({ page }, testInfo) => {
    await loginAsAdmin(page);
    await page.getByRole("button", { name: /Dueño/ }).click();
    await page.getByRole("menuitem", { name: "Panel" }).click();
    await expect(page).toHaveURL(/\/panel$/);
    await expect(page.getByRole("heading", { name: "Panel", level: 1 })).toBeVisible();

    const nav = page.getByRole("navigation", { name: "Panel" });
    for (const name of ["Inicio", "Pedidos", "Productos", "Más"]) {
      await expect(nav.getByRole("link", { name })).toBeVisible();
    }
    await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

    const box = await nav.boundingBox();
    const viewport = page.viewportSize()!;
    if (testInfo.project.name === "mobile") {
      expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 2); // barra pegada abajo
    } else {
      expect(box!.x).toBeLessThan(10); // columna a la izquierda
      expect(box!.height).toBeGreaterThan(viewport.height / 2);
    }

    await nav.getByRole("link", { name: "Más" }).click();
    await expect(page.getByRole("link", { name: "Ajustes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Administradores" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver la tienda" })).toHaveAttribute("href", "/");
  });
});
