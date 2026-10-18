import { describe, expect, it } from "vitest";
import { escapeLike, normalizeSearch } from "./search";

describe("normalizeSearch", () => {
  it("quita tildes, pasa a minúsculas y colapsa espacios", () => {
    expect(normalizeSearch("  CATÁN   Niños ")).toBe("catan ninos");
  });
});

describe("escapeLike", () => {
  it("escapa los comodines de ILIKE y la barra invertida", () => {
    expect(escapeLike("50%_a\\b")).toBe("50\\%\\_a\\\\b");
  });
});
