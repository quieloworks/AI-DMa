/**
 * Herramientas, instrumentos y juegos del PHB 5E (cap. 5 — equipo).
 * Nomenclatura en español alineada con el resto del proyecto.
 */

import type { BackgroundBasics } from "./character";

export type ToolPickPool = "instruments" | "artisan" | "artisan-or-instrument" | "gaming";

/** PHB: lista de instrumentos musicales. */
export const PHB_MUSICAL_INSTRUMENTS: readonly string[] = [
  "Gaita",
  "Tambor",
  "Dulcémele",
  "Flauta",
  "Laúd",
  "Lira",
  "Cuerno",
  "Flauta de pan",
  "Chirimía",
  "Viol",
];

/** PHB: herramientas de artesano por tipo. */
export const PHB_ARTISAN_TOOLS: readonly string[] = [
  "Herramientas de alquimista",
  "Herramientas de herrero",
  "Suministros de cervecero",
  "Suministros de calígrafo",
  "Herramientas de carpintero",
  "Herramientas de cartógrafo",
  "Herramientas de zapatero",
  "Utensilios de cocinero",
  "Herramientas de soplador de vidrio",
  "Herramientas de joyero",
  "Herramientas de peletero",
  "Herramientas de albañil",
  "Suministros de pintor",
  "Herramientas de alfarero",
  "Herramientas de chapucero",
  "Herramientas de tejedor",
  "Herramientas de tallador de madera",
];

/** PHB: juegos de mesa / azar. */
export const PHB_GAMING_SETS: readonly string[] = [
  "Dados",
  "Dragón (juego de mesa)",
  "Ante de tres dragones",
  "Baraja",
];

const ARTISAN_OR_INSTRUMENT: readonly string[] = [...PHB_ARTISAN_TOOLS, ...PHB_MUSICAL_INSTRUMENTS].sort((a, b) =>
  a.localeCompare(b, "es"),
);

export function toolsInPool(pool: ToolPickPool): readonly string[] {
  if (pool === "instruments") return PHB_MUSICAL_INSTRUMENTS;
  if (pool === "artisan") return PHB_ARTISAN_TOOLS;
  if (pool === "gaming") return PHB_GAMING_SETS;
  return ARTISAN_OR_INSTRUMENT;
}

export function isToolInPool(pool: ToolPickPool, name: string): boolean {
  return toolsInPool(pool).includes(name);
}

/** Si una entrada del trasfondo es un marcador que debe sustituirse por una elección concreta. */
export function backgroundEntryPickPool(entry: string): ToolPickPool | null {
  if (entry === "Herramientas de un artesano" || entry === "Un juego de herramientas de artesano") return "artisan";
  if (entry === "Un instrumento musical") return "instruments";
  if (entry === "Un juego de juegos") return "gaming";
  return null;
}

export function backgroundToolPickSpecs(bg: BackgroundBasics): { pool: ToolPickPool }[] {
  return bg.tools
    .map((t) => backgroundEntryPickPool(t))
    .filter((p): p is ToolPickPool => p != null)
    .map((pool) => ({ pool }));
}

export function backgroundToolPickCount(bg: BackgroundBasics): number {
  return backgroundToolPickSpecs(bg).length;
}

/** Sustituye solo las entradas “marcador”; el resto se copian tal cual. */
export function resolveBackgroundTools(bg: BackgroundBasics, picks: string[]): string[] {
  let i = 0;
  const out: string[] = [];
  for (const t of bg.tools) {
    const pool = backgroundEntryPickPool(t);
    if (pool) {
      const chosen = picks[i++];
      out.push(chosen && isToolInPool(pool, chosen) ? chosen : t);
    } else {
      out.push(t);
    }
  }
  return out;
}

export function validateBackgroundToolPicks(bg: BackgroundBasics, picks: string[]): boolean {
  const specs = backgroundToolPickSpecs(bg);
  if (specs.length === 0) return picks.length === 0;
  if (picks.length !== specs.length) return false;
  return specs.every((s, idx) => picks[idx] && isToolInPool(s.pool, picks[idx]));
}

export type ClassToolPickRule = { count: number; pool: "instruments" | "artisan-or-instrument" };

export function validateClassToolPicks(rule: ClassToolPickRule | undefined, picks: string[]): boolean {
  if (!rule) return picks.length === 0;
  if (picks.length !== rule.count) return false;
  if (picks.some((p) => !p || !isToolInPool(rule.pool, p))) return false;
  if (rule.pool === "instruments" && new Set(picks).size !== picks.length) return false;
  return true;
}
