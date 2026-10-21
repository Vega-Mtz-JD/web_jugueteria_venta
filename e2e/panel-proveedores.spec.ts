import { test, expect } from "@playwright/test";
import { loginAsAdmin } from "./helpers/admin";
import { createRawPurchase, createSupplier } from "./helpers/supabase-admin";

test.describe("proveedores en el panel", () => {
  test("crear un proveedor y escribirle por WhatsApp", async ({ page }) => {
    const name = `Distribuidora Andina ${crypto.randomUUID().slice(0, 6)}`;
    await loginAsAdmin(page);
    await page.goto("/panel/mas");
    await page.getByRole("link", { name: /Proveedores/ }).click();
    await expect(page.getByRole("heading", { name: "Proveedores", level: 1 })).toBeVisible();

    const form = page.getByRole("region", { name: "Nuevo proveedor" });
    await form.getByLabel("Nombre").fill(name);
    await form.getByLabel("WhatsApp").fill("71234567");
    await form.getByRole("button", { name: "Agregar proveedor" }).click();

    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Escribir por WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/59171234567/);
    await page.goto("/panel/proveedores");
    await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  });

  test("borrar: sin compras se borra; con compras se desactiva", async ({ page }) => {
    const empty = await createSupplier();
    const used = await createSupplier();
    await createRawPurchase(used.id);
    await loginAsAdmin(page);

    await page.goto(`/panel/proveedores/${empty.id}`);
    await page.getByRole("button", { name: "Borrar proveedor" }).click();
    await page.getByRole("button", { name: "Sí, borrar" }).click();
    await expect(page).toHaveURL(/\/panel\/proveedores\?borrado=1$/);
    await expect(page.getByRole("link", { name: new RegExp(empty.name) })).toHaveCount(0);

    await page.goto(`/panel/proveedores/${used.id}`);
    await page.getByRole("button", { name: "Borrar proveedor" }).click();
    await page.getByRole("button", { name: "Sí, borrar" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Se desactivó porque tiene compras" })).toBeVisible();
    await expect(page.getByLabel("Activo")).not.toBeChecked();
  });
});
