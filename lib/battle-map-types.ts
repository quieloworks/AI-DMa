export type BattleParticipantKind = "player" | "ally" | "enemy" | "neutral";

export type BattleParticipant = {
  id: string;
  name: string;
  kind: BattleParticipantKind;
  x: number;
  y: number;
  hp?: { current: number; max: number };
  status?: string[];
  /** Solo DM / modelo; no enviar a jugadores. */
  dm_personality?: string;
};

export type BattleMap = {
  terrain?: string;
  grid: { cols: number; rows: number; cellFeet?: number };
  participants: BattleParticipant[];
  obstacles?: Array<{ x: number; y: number; w?: number; h?: number; kind?: string }>;
};
