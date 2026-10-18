export function ageLabel(minAge: number | null): string | null {
  return minAge === null ? null : `${minAge}+ años`;
}

export function playersLabel(min: number | null, max: number | null): string | null {
  if (min === null) return null;
  const plural = (n: number) => (n === 1 ? "jugador" : "jugadores");
  if (max === null) return `${min}+ ${plural(2)}`;
  if (min === max) return `${min} ${plural(min)}`;
  return `${min}–${max} ${plural(max)}`;
}
