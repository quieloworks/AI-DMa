import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getIo } from "@/server/io-bus";
import type { SessionCombatTracker } from "@/lib/session-combat-tracker";
import { stripBattleMapDmSecrets } from "@/lib/battle-map-dm-secrets";
import type { BattleMap } from "@/lib/battle-map-types";
import { movementCostFeet } from "@/lib/tactical-path";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

type InitiativeEntry = { player_id: string; value: number };

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: sessionId } = await ctx.params;
  let body: { playerId?: string; token?: string; toX?: number; toY?: number };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: serverT("errors.textRequired") }, { status: 400 });
  }
  const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const toX = Number(body.toX);
  const toY = Number(body.toY);
  if (!playerId || !token || !Number.isFinite(toX) || !Number.isFinite(toY)) {
    return NextResponse.json({ error: serverT("errors.textRequired") }, { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare<[string, string], { token: string; character_id: string }>(
      "SELECT token, character_id FROM session_player WHERE session_id = ? AND player_id = ?"
    )
    .get(sessionId, playerId);
  if (!row || row.token !== token) {
    return NextResponse.json({ error: serverT("errors.invalidToken") }, { status: 403 });
  }

  const session = db.prepare<string, { state_json: string }>("SELECT state_json FROM session WHERE id = ?").get(sessionId);
  if (!session) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });

  let state: PersistedState = {};
  try {
    state = JSON.parse(session.state_json) as PersistedState;
  } catch {
    return NextResponse.json({ error: serverT("errors.textRequired") }, { status: 400 });
  }

  if (state.combat !== true || !state.battleMap || !state.combatTracker) {
    return NextResponse.json({ error: serverT("tacticalMove.notInCombat") }, { status: 409 });
  }

  const ct = state.combatTracker;
  if (ct.turn_of !== playerId) {
    return NextResponse.json({ error: serverT("tacticalMove.notYourTurn") }, { status: 403 });
  }
  if (ct.phase !== "turn_open") {
    return NextResponse.json({ error: serverT("tacticalMove.phaseBlocked") }, { status: 409 });
  }

  const bm = state.battleMap;
  const me = bm.participants.find((p) => p.id === playerId && p.kind === "player");
  if (!me) {
    return NextResponse.json({ error: serverT("tacticalMove.noTokenOnMap") }, { status: 409 });
  }

  const gx = Math.floor(toX);
  const gy = Math.floor(toY);
  const cols = Math.max(1, bm.grid.cols);
  const rows = Math.max(1, bm.grid.rows);
  if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) {
    return NextResponse.json({ error: serverT("tacticalMove.outOfBounds") }, { status: 400 });
  }
  if (gx === me.x && gy === me.y) {
    return NextResponse.json({ ok: true, battleMap: stripBattleMapDmSecrets(bm), combatTracker: ct });
  }

  const ch = db.prepare<string, { data_json: string }>("SELECT data_json FROM character WHERE id = ?").get(row.character_id);
  const speed = ch ? playerSpeedFeet(ch.data_json) : 30;
  const budget =
    typeof ct.movement_remaining_feet === "number" && Number.isFinite(ct.movement_remaining_feet)
      ? Math.max(0, Math.floor(ct.movement_remaining_feet))
      : speed;

  const cost = movementCostFeet(bm, { x: me.x, y: me.y }, { x: gx, y: gy }, playerId);
  if (cost === null || cost > budget) {
    return NextResponse.json({ error: serverT("tacticalMove.moveTooFar") }, { status: 400 });
  }

  const nextParticipants = bm.participants.map((p) => (p.id === playerId ? { ...p, x: gx, y: gy } : p));
  const nextBm: BattleMap = { ...bm, participants: nextParticipants };
  const remaining = Math.max(0, budget - cost);
  const nextCt: SessionCombatTracker = { ...ct, movement_remaining_feet: remaining };

  const nextState: PersistedState = { ...state, battleMap: nextBm, combatTracker: nextCt };
  db.prepare("UPDATE session SET state_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(nextState), Date.now(), sessionId);

  const sysText = serverT("tacticalMove.systemMoved", { x: gx, y: gy, cost, remaining });
  db.prepare(
    `INSERT INTO session_message(session_id, role, player_id, kind, content, created_at) VALUES(?, 'system', ?, 'public', ?, ?)`
  ).run(sessionId, playerId, sysText, Date.now());

  emitScene(sessionId, nextState);

  return NextResponse.json({
    ok: true,
    battleMap: stripBattleMapDmSecrets(nextBm),
    combatTracker: nextCt,
  });
}
