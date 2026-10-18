import { describe, expect, it } from "vitest";
import { ageLabel, playersLabel } from "./labels";

describe("ageLabel", () => {
  it("muestra la edad mínima", () => {
    expect(ageLabel(8)).toBe("8+ años");
  });

  it("devuelve null si no hay edad", () => {
    expect(ageLabel(null)).toBeNull();
  });
});

describe("playersLabel", () => {
  it("muestra un rango de jugadores", () => {
    expect(playersLabel(2, 4)).toBe("2–4 jugadores");
  });

  it("usa singular para un solo jugador", () => {
    expect(playersLabel(1, 1)).toBe("1 jugador");
  });

  it("muestra 'N+' cuando no hay máximo", () => {
    expect(playersLabel(2, null)).toBe("2+ jugadores");
  });

  it("devuelve null si no hay datos", () => {
    expect(playersLabel(null, null)).toBeNull();
  });
});
