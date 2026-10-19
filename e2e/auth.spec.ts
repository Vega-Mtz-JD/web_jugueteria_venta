import { test, expect, type Page } from "@playwright/test";
import { createTestUser, latestEmailHtml, TEST_PASSWORD } from "./helpers/supabase-admin";

async function login(page: Page, email: string, password: string) {
  await page.getByLabel("Correo").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Ingresar" }).click();
}

test.describe("cuentas", () => {
  test("registrarse deja la sesión iniciada", async ({ page }) => {
    await page.goto("/registro");
    await page.getByLabel("Nombre completo").fill("Rosa Mamani");
    await page.getByLabel("Correo").fill(`e2e-${crypto.randomUUID()}@test.bo`);
    await page.getByLabel("Contraseña").fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByRole("button", { name: /Rosa/ })).toBeVisible();
  });

  test("ingresar, salir y contraseña incorrecta", async ({ page }) => {
    const user = await createTestUser("Luis Condori");
    await page.goto("/ingresar");
    await login(page, user.email, "otra-clave-mala");
    await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
    await login(page, user.email, user.password);
    const menu = page.getByRole("button", { name: /Luis/ });
    await expect(menu).toBeVisible();
    await menu.click();
    await page.getByRole("menuitem", { name: "Salir" }).click();
    await expect(page.getByRole("link", { name: "Ingresar" })).toBeVisible();
  });

  test("las páginas de compra piden sesión y vuelven al lugar", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/pedidos");
    await expect(page).toHaveURL(/\/ingresar\?siguiente=%2Fpedidos$/);
    await login(page, user.email, user.password);
    await expect(page).toHaveURL(/\/pedidos$/);
  });

  test("no redirige a sitios externos después de ingresar", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/ingresar?siguiente=https://evil.com");
    await login(page, user.email, user.password);
    await expect(page).toHaveURL(/localhost:3000\/$/);
  });

  test("recuperar la contraseña por correo", async ({ page }) => {
    const user = await createTestUser();
    await page.goto("/recuperar");
    await page.getByLabel("Correo").fill(user.email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText(/te enviamos un enlace/i)).toBeVisible();
    const html = await latestEmailHtml(user.email);
    const link = html.match(/href="([^"]*\/auth\/confirm[^"]*)"/)?.[1]?.replaceAll("&amp;", "&");
    expect(link).toBeTruthy();
    await page.goto(link!);
    await expect(page).toHaveURL(/\/nueva-clave$/);
    await page.getByLabel("Nueva contraseña").fill("otra-clave-segura-456");
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page.getByText("Tu contraseña se actualizó")).toBeVisible();
  });
});
