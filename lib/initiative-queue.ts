import type { SessionCombatTracker } from "@/lib/session-combat-tracker";
import type { InitiativeEntry } from "@/lib/combat-turn";
import { sortedInitiative } from "@/lib/combat-turn";

/**
 * Cola visual de asalto: orden fijo por tirada (mayor primero), rotada para que el combatiente activo quede primero
 * (metáfora “quien ya actuó va al final” dentro de la misma ronda).
 */
export function rotatedInitiativeOrder(
  initiative: InitiativeEntry[],
  turnOfId: string,
  fallbackInitiativeIndex?: number,
): InitiativeEntry[] {
  const sorted = sortedInitiative(initiative);
  if (!sorted.length) return [];

  let idx = sorted.findIndex((e) => e.player_id === turnOfId);
  if (idx < 0 && typeof fallbackInitiativeIndex === "number") {
    const clamped = Math.max(0, Math.min(sorted.length - 1, Math.floor(fallbackInitiativeIndex)));
    idx = clamped;
  }
  if (idx < 0) return sorted;

  return [...sorted.slice(idx), ...sorted.slice(0, idx)];
}

/** Variante que acepta el tracker completo para usar initiative_index como respaldo. */
export function rotatedInitiativeOrderFromTracker(
  initiative: InitiativeEntry[],
  tracker: Pick<SessionCombatTracker, "turn_of" | "initiative_index">,
): InitiativeEntry[] {
  return rotatedInitiativeOrder(initiative, tracker.turn_of, tracker.initiative_index);
}
