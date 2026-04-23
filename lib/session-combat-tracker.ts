/** Fases del reloj de combate 5E (PHB: asalto → iniciativa → turnos en orden → siguiente ronda). No es “turno de app”. */
export type CombatTrackerPhase =
  | "initiative"
  | "awaiting_dice"
  | "same_turn_resolution"
  | "turn_open"
  /** Declaración de movimiento en mapa (app móvil); el DM puede usar esta fase antes de acciones/ataques. */
  | "player_movement"
  | "between_actors";

/** Estado explícito del reloj de batalla; lo emite el DM en <acciones> y la app lo persiste. */
export type SessionCombatTracker = {
  round: number;
  initiative_index: number;
  turn_of: string;
  phase: CombatTrackerPhase;
  note?: string;
  /** Pies de movimiento que le quedan al actor del turno (PJs); lo decreta el servidor al mover en mapa. */
  movement_remaining_feet?: number;
};

const COMBAT_TRACKER_PHASES = new Set<string>([
  "initiative",
  "awaiting_dice",
  "same_turn_resolution",
  "turn_open",
  "player_movement",
  "between_actors",
]);

/** Fases en las que el PJ puede usar el mapa táctico (preparar/confirmar movimiento). */
export function phaseAllowsPlayerMapMove(phase: CombatTrackerPhase): boolean {
  return phase === "turn_open" || phase === "player_movement";
}

/** Normaliza combat_tracker del JSON del modelo; null = ausente o inválido. */
export function coerceCombatTracker(raw: unknown): SessionCombatTracker | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const round = Number(o.round);
  const initiative_index = Number(o.initiative_index);
  const turn_of = typeof o.turn_of === "string" ? o.turn_of.trim() : "";
  const phaseStr = typeof o.phase === "string" ? o.phase.trim() : "";
  if (!Number.isFinite(round) || round < 1 || round > 999) return null;
  if (!Number.isFinite(initiative_index) || initiative_index < 0 || initiative_index > 99) return null;
  if (!turn_of || turn_of.length > 160) return null;
  if (!COMBAT_TRACKER_PHASES.has(phaseStr)) return null;
  const phase = phaseStr as CombatTrackerPhase;
  const note = typeof o.note === "string" ? o.note.trim().slice(0, 220) : undefined;
  const movRaw = o.movement_remaining_feet;
  let movement_remaining_feet: number | undefined;
  if (typeof movRaw === "number" && Number.isFinite(movRaw)) {
    const m = Math.floor(movRaw);
    if (m >= 0 && m <= 2000) movement_remaining_feet = m;
  }
  return {
    round: Math.floor(round),
    initiative_index: Math.floor(initiative_index),
    turn_of,
    phase,
    ...(note ? { note } : {}),
    ...(movement_remaining_feet !== undefined ? { movement_remaining_feet } : {}),
  };
}
