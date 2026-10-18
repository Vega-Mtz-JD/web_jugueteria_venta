import { test, expect } from "@playwright/test";

test("sitemap.xml lista el catálogo y los productos", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const xml = await res.text();
  expect(xml).toContain("/catalogo");
  expect(xml).toContain("/producto/catan");
  expect(xml).not.toContain("/producto/risk");
});

test("robots.txt permite rastrear y apunta al sitemap", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  expect(await res.text()).toMatch(/Sitemap: .*\/sitemap\.xml/);
});
