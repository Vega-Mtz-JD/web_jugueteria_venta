import { test, expect } from "@playwright/test";

test("la página de inicio responde en español", async ({ page }) => {
  const res = await page.goto("/");
  expect(res?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
});
