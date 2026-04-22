/**
 * D&D 5e PHB: XP acumulado total mínimo para alcanzar al menos ese nivel.
 * MIN_XP_FOR_LEVEL[L] = XP mínimo para ser nivel L (L = 1…20; el índice 0 no se usa).
 */
const MIN_XP_FOR_LEVEL: readonly number[] = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000,
  225000, 265000, 305000, 355000,
];

/** Nivel de personaje (1–20) a partir del XP total acumulado (PHB). */
export function levelFromTotalXp(totalXp: unknown): number {
  const x = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  for (let candidate = 2; candidate <= 20; candidate++) {
    if (x >= MIN_XP_FOR_LEVEL[candidate]!) level = candidate;
    else break;
  }
  return level;
}
