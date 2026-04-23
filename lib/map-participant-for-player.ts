import type { BattleMap, BattleParticipant } from "@/lib/battle-map-types";

/**
 * Localiza la ficha del PJ en el mapa para movimiento: prioridad `participants[].id === playerId`,
 * luego `id === characterId`, luego único `kind === "player"` en mesas de un solo PJ.
 */
export function findPlayerParticipantForSession(
  battleMap: BattleMap,
  playerId: string,
  characterId?: string | null
): BattleParticipant | null {
  const pjs = battleMap.participants.filter((p) => p.kind === "player");
  const byPlayer = pjs.find((p) => p.id === playerId);
  if (byPlayer) return byPlayer;
  if (characterId) {
    const byChar = pjs.find((p) => p.id === characterId);
    if (byChar) return byChar;
  }
  if (pjs.length === 1) return pjs[0] ?? null;
  return null;
}
