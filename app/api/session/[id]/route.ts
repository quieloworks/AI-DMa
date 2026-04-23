import { NextRequest, NextResponse } from "next/server";
import type { BattleMap } from "@/lib/battle-map-types";
import { getDb } from "@/lib/db";
import { stripBattleMapDmSecrets } from "@/lib/battle-map-dm-secrets";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const session = db
    .prepare<string, { id: string; story_id: string; state_json: string; turn: number }>(
      "SELECT id, story_id, state_json, turn FROM session WHERE id = ?"
    )
    .get(id);
  if (!session) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });

  const story = db
    .prepare<string, { id: string; title: string; mode: string; summary: string | null; data_json: string }>(
      "SELECT id, title, mode, summary, data_json FROM story WHERE id = ?"
    )
    .get(session.story_id);

  const players = db
    .prepare<string, { player_id: string; character_id: string; token: string; connected: number }>(
      "SELECT player_id, character_id, token, connected FROM session_player WHERE session_id = ?"
    )
    .all(id);

  const characters = players.map((p) => {
    const c = db
      .prepare<string, { id: string; name: string; level: number; class: string | null; race: string | null; data_json: string }>(
        "SELECT id, name, level, class, race, data_json FROM character WHERE id = ?"
      )
      .get(p.character_id);
    return { player_id: p.player_id, token: p.token, connected: !!p.connected, character: c ? { ...c, data: JSON.parse(c.data_json) } : null };
  });

  const messages = db
    .prepare<string, { id: number; role: string; player_id: string | null; kind: string; content: string; created_at: number }>(
      "SELECT id, role, player_id, kind, content, created_at FROM session_message WHERE session_id = ? ORDER BY id ASC LIMIT 200"
    )
    .all(id);

  const state = JSON.parse(session.state_json) as { battleMap?: BattleMap | null };
  if (state.battleMap) state.battleMap = stripBattleMapDmSecrets(state.battleMap);

  return NextResponse.json({
    session,
    story,
    players: characters,
    messages,
    state,
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { state?: Record<string, unknown>; characterPatch?: { characterId: string; patch: Record<string, unknown> } };
  const db = getDb();

  if (body.state) {
    const row = db.prepare<string, { state_json: string }>("SELECT state_json FROM session WHERE id = ?").get(id);
    if (!row) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });
    const merged = { ...JSON.parse(row.state_json), ...body.state };
    db.prepare("UPDATE session SET state_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(merged), Date.now(), id);
  }

  if (body.characterPatch) {
    const ch = db.prepare<string, { data_json: string }>("SELECT data_json FROM character WHERE id = ?").get(body.characterPatch.characterId);
    if (ch) {
      const merged = { ...JSON.parse(ch.data_json), ...body.characterPatch.patch };
      db.prepare("UPDATE character SET data_json = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(merged), Date.now(), body.characterPatch.characterId);
    }
  }

  return NextResponse.json({ ok: true });
}
