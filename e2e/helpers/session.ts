import { expect, type Page } from "@playwright/test";
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

/**
 * Elige la captura y espera la vista previa. Si el archivo se eligió antes de que React
 * hidratara la página, el onChange no corre: se vuelve a intentar hasta que aparezca.
 */
export async function chooseProof(page: Page, file: string, expectPreview = true) {
  const input = page.getByLabel("Captura del pago");
  await expect(async () => {
    // React solo dispara onChange si el valor cambia: vaciar antes de volver a elegir el mismo archivo.
    await input.setInputFiles([]);
    await input.setInputFiles(file);
    const signal = expectPreview
      ? page.getByRole("img", { name: "Vista previa de la captura" })
      : page.getByText("Sube una imagen (foto o captura de pantalla)");
    await expect(signal).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15000 });
}
