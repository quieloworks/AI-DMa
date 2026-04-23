import type { BattleMap } from "@/lib/battle-map-types";

/** Quita campos solo-DM del mapa antes de enviarlos a clientes o APIs públicas. */
export function stripBattleMapDmSecrets(map: BattleMap | null): BattleMap | null {
  if (!map?.participants?.length) return map;
  return {
    ...map,
    participants: map.participants.map((p) => {
      const { dm_personality: _omit, ...rest } = p as typeof p & { dm_personality?: string };
      return rest;
    }),
  };
}
