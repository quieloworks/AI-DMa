import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

type CreateStory = {
  title: string;
  mode: "auto" | "assistant";
  seed?: string;
  source_pdf?: string;
  playerCharacterIds: string[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CreateStory;
  const db = getDb();
  const now = Date.now();
  const storyId = nanoid(12);
  const sessionId = nanoid(12);

  db.prepare(
    `INSERT INTO story(id, title, mode, source_pdf, summary, data_json, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    storyId,
    body.title,
    body.mode,
    body.source_pdf ?? null,
    body.seed ?? null,
    JSON.stringify({ seed: body.seed ?? null, playerCharacterIds: body.playerCharacterIds }),
    now,
    now
  );

  db.prepare(
    `INSERT INTO session(id, story_id, state_json, turn, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?)`
  ).run(sessionId, storyId, JSON.stringify({ players: [], recentLog: [], summary: body.seed ?? "" }), now, now);

  const playerStmt = db.prepare(
    `INSERT INTO session_player(session_id, player_id, character_id, token, connected) VALUES(?, ?, ?, ?, 0)`
  );
  for (const chId of body.playerCharacterIds) {
    playerStmt.run(sessionId, nanoid(8), chId, nanoid(10));
  }

  return NextResponse.json({ storyId, sessionId });
}
