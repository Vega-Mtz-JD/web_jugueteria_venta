import { describe, expect, it } from "vitest";
import { isProtectedPath, safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("acepta rutas internas", () => {
    expect(safeRedirectPath("/pedidos")).toBe("/pedidos");
    expect(safeRedirectPath("/checkout?x=1")).toBe("/checkout?x=1");
  });
  it("rechaza destinos externos o raros", () => {
    expect(safeRedirectPath("https://evil.com")).toBe("/");
    expect(safeRedirectPath("//evil.com")).toBe("/");
    expect(safeRedirectPath("/\\evil.com")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
    expect(safeRedirectPath("")).toBe("/");
  });
  it("rechaza trucos con tabuladores, saltos de línea o barras invertidas", () => {
    expect(safeRedirectPath("/\t/evil.com")).toBe("/");
    expect(safeRedirectPath("/\n/evil.com")).toBe("/");
    expect(safeRedirectPath("/\r\n/evil.com")).toBe("/");
    expect(safeRedirectPath("/a\\b")).toBe("/");
  });
});

describe("isProtectedPath", () => {
  it("protege la compra, los pedidos y el panel", () => {
    for (const p of ["/checkout", "/pedidos", "/pedidos/abc", "/panel", "/panel/pedidos/1"]) expect(isProtectedPath(p)).toBe(true);
  });
  it("deja libre el catálogo y rutas parecidas", () => {
    for (const p of ["/", "/catalogo", "/panelito", "/producto/panel"]) expect(isProtectedPath(p)).toBe(false);
  });
});
