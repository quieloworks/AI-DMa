import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getIo } from "@/server/io-bus";
import type { SessionCombatTracker } from "@/lib/session-combat-tracker";
import { stripBattleMapDmSecrets } from "@/lib/battle-map-dm-secrets";
import type { BattleMap } from "@/lib/battle-map-types";
import { advanceInitiativeTurn, type InitiativeEntry } from "@/lib/combat-turn";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

type PersistedState = {
  combat?: boolean;
  battleMap?: BattleMap | null;
  combatTracker?: SessionCombatTracker | null;
  initiative?: InitiativeEntry[];
  sceneTags?: string[];
};

function playerSpeedFeet(characterDataJson: string): number {
  try {
    const d = JSON.parse(characterDataJson) as { speed?: number };
    const s = typeof d.speed === "number" && Number.isFinite(d.speed) ? Math.floor(d.speed) : 30;
    return Math.max(5, Math.min(200, s));
  } catch {
    return 30;
  }
}

function emitScene(sessionId: string, state: PersistedState) {
  const io = getIo();
  if (!io) return;
  io.to(`session:${sessionId}`).emit("scene:update", {
    sessionId,
    combat: state.combat === true,
    battleMap: stripBattleMapDmSecrets(state.battleMap ?? null),
    combatTracker: state.combatTracker ?? null,
    initiative: Array.isArray(state.initiative) ? state.initiative : [],
    sceneTags: state.sceneTags ?? [],
  });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await ctx.params;
  const db = getDb();
  const session = db.prepare<string, { state_json: string }>("SELECT state_json FROM session WHERE id = ?").get(sessionId);
  if (!session) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });

  let state: PersistedState = {};
  try {
    state = JSON.parse(session.state_json) as PersistedState;
  } catch {
    return NextResponse.json({ error: serverT("errors.badRequest") }, { status: 400 });
  }

  if (state.combat !== true || !state.combatTracker) {
    return NextResponse.json({ error: serverT("combatAdvance.notInCombat") }, { status: 409 });
  }

  const init = Array.isArray(state.initiative) ? (state.initiative as InitiativeEntry[]) : [];
  if (!init.length) {
    return NextResponse.json({ error: serverT("combatAdvance.noInitiative") }, { status: 409 });
  }

  let nextCt = advanceInitiativeTurn(init, state.combatTracker);

  const row = db
    .prepare<[string, string], { character_id: string }>(
      "SELECT character_id FROM session_player WHERE session_id = ? AND player_id = ?"
    )
    .get(sessionId, nextCt.turn_of);
  if (row) {
    const ch = db.prepare<string, { data_json: string }>("SELECT data_json FROM character WHERE id = ?").get(row.character_id);
    if (ch) {
      nextCt = { ...nextCt, movement_remaining_feet: playerSpeedFeet(ch.data_json) };
    }
  }

  const nextState: PersistedState = { ...state, combatTracker: nextCt };
  db.prepare("UPDATE session SET state_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(nextState), Date.now(), sessionId);

  emitScene(sessionId, nextState);

  return NextResponse.json({ ok: true, combatTracker: nextCt });
}
