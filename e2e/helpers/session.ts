import type { Page } from "@playwright/test";
import { createTestUser } from "./supabase-admin";

/** Crea un usuario de prueba e ingresa con él. */
export async function loginAsNewUser(page: Page, fullName = "Ana Prueba") {
  const user = await createTestUser(fullName);
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: new RegExp(fullName.split(" ")[0]) }).waitFor();
  return user;
}

export async function addToCart(page: Page, slug: string) {
  await page.goto(`/producto/${slug}`);
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await page.getByText("Agregado").waitFor();
}
