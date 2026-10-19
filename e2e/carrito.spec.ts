import { test, expect } from "@playwright/test";
import { createTestUser, setProduct } from "./helpers/supabase-admin";

const cartLink = (page: import("@playwright/test").Page) => page.getByRole("banner").getByRole("link", { name: /Ver carrito/ });

test.describe("carrito", () => {
  test("agregar desde la ficha y desde una tarjeta, y se guarda al recargar", async ({ page }) => {
    await page.goto("/producto/catan");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByText("Agregado")).toBeVisible();
    await expect(cartLink(page)).toHaveAccessibleName(/1 producto/);
    await page.goto("/catalogo?categoria=cartas");
    await page.getByRole("button", { name: "Agregar «Dobble» al carrito" }).click();
    await expect(cartLink(page)).toHaveAccessibleName(/2 productos/);
    await page.reload();
    await expect(cartLink(page)).toHaveAccessibleName(/2 productos/);
  });

  test("cambiar cantidades, respetar el stock y quitar", async ({ page }) => {
    await page.goto("/producto/jenga");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto("/carrito");
    const line = page.getByTestId("cart-line").filter({ hasText: "Jenga" });
    await line.getByRole("button", { name: "Sumar uno" }).click();
    await expect(line.getByRole("spinbutton", { name: "Cantidad" })).toHaveValue("2");
    await expect(line.getByRole("button", { name: "Sumar uno" })).toBeDisabled();
    await expect(page.getByText("Bs 300", { exact: true }).first()).toBeVisible();
    await line.getByRole("button", { name: "Quitar «Jenga»" }).click();
    await expect(page.getByText("Tu carrito está vacío")).toBeVisible();
  });

  test("el carrito sigue igual después de ingresar", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/producto/uno");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await page.goto("/ingresar");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByLabel("Contraseña").fill(user.password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page.getByRole("button", { name: /Ana/ })).toBeVisible();
    await expect(cartLink(page)).toHaveAccessibleName(/1 producto/);
  });

  test("si un producto se agota, el carrito avisa y lo quita", async ({ page }) => {
    await page.goto("/producto/carcassonne");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await setProduct("carcassonne", { stock: 0 });
    try {
      await page.goto("/carrito");
      await expect(page.getByText(/Ajustamos tu carrito/)).toContainText("Carcassonne");
      await expect(page.getByTestId("cart-line")).toHaveCount(0);
    } finally {
      await setProduct("carcassonne", { stock: 4 });
    }
  });
});
