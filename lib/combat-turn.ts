import type { SessionCombatTracker } from "@/lib/session-combat-tracker";

export type InitiativeEntry = { player_id: string; value: number };

export function sortedInitiative(init: InitiativeEntry[]): InitiativeEntry[] {
  return [...init].sort((a, b) => b.value - a.value);
}

/** Siguiente combatiente en orden de iniciativa (mayor tirada = índice 0). */
export function advanceInitiativeTurn(
  initiative: InitiativeEntry[],
  tracker: SessionCombatTracker
): SessionCombatTracker {
  const sorted = sortedInitiative(initiative);
  if (!sorted.length) return tracker;
  let idx = tracker.initiative_index + 1;
  let round = tracker.round;
  if (idx >= sorted.length) {
    idx = 0;
    round = Math.min(999, round + 1);
  }
  const turn_of = sorted[idx]!.player_id;
  return {
    ...tracker,
    round,
    initiative_index: idx,
    turn_of,
    phase: "turn_open",
    note: undefined,
    movement_remaining_feet: undefined,
  };
}
