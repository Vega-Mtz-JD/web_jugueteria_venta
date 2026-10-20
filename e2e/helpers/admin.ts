import type { Page } from "@playwright/test";
import { createTestUser, makeAdmin } from "./supabase-admin";

/** Crea un usuario, lo hace administrador e ingresa con él. */
export async function loginAsAdmin(page: Page, fullName = "Dueño Prueba") {
  const user = await createTestUser(fullName);
  await makeAdmin(user.id);
  await page.goto("/ingresar");
  await page.getByLabel("Correo").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await page.getByRole("button", { name: new RegExp(fullName.split(" ")[0]) }).waitFor();
  return user;
}
