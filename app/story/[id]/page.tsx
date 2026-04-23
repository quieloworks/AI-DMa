import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import type { BattleMap } from "@/lib/battle-map-types";
import { getDb, setMeta } from "@/lib/db";
import { stripBattleMapDmSecrets } from "@/lib/battle-map-dm-secrets";
import { StoryRoom, type StoryRoomInitialState } from "./room";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  let session = db
    .prepare<string, { id: string; story_id: string; state_json: string; turn: number }>(
      "SELECT id, story_id, state_json, turn FROM session WHERE id = ?"
    )
    .get(id);

  if (!session) {
    const story = db
      .prepare<string, { id: string }>("SELECT id FROM story WHERE id = ?")
      .get(id);
    if (story) {
      session = db
        .prepare<string, { id: string; story_id: string; state_json: string; turn: number }>(
          "SELECT id, story_id, state_json, turn FROM session WHERE story_id = ? ORDER BY updated_at DESC LIMIT 1"
        )
        .get(story.id);
    }
  }

  if (!session) notFound();

  const sessionId = session.id;

  const story = db
    .prepare<string, { id: string; title: string; mode: "auto" | "assistant"; summary: string | null }>(
      "SELECT id, title, mode, summary FROM story WHERE id = ?"
    )
    .get(session.story_id);
  if (!story) notFound();

  setMeta("active_session_id", sessionId);

  const players = db
    .prepare<string, { player_id: string; character_id: string; token: string; connected: number }>(
      "SELECT player_id, character_id, token, connected FROM session_player WHERE session_id = ?"
    )
    .all(sessionId);

  const characters = players.map((p) => {
    const c = db
      .prepare<string, { id: string; name: string; level: number; class: string | null; race: string | null; data_json: string }>(
        "SELECT id, name, level, class, race, data_json FROM character WHERE id = ?"
      )
      .get(p.character_id);
    return {
      playerId: p.player_id,
      token: p.token,
      connected: !!p.connected,
      character: c ? { id: c.id, name: c.name, level: c.level, class: c.class, race: c.race, data: JSON.parse(c.data_json) } : null,
    };
  });

  const messages = db
    .prepare<string, { id: number; role: string; player_id: string | null; kind: string; content: string; created_at: number }>(
      "SELECT id, role, player_id, kind, content, created_at FROM session_message WHERE session_id = ? ORDER BY id ASC LIMIT 200"
    )
    .all(sessionId);

  const initialState = JSON.parse(session.state_json) as Record<string, unknown>;
  if (initialState.battleMap && typeof initialState.battleMap === "object") {
    initialState.battleMap = stripBattleMapDmSecrets(initialState.battleMap as BattleMap);
  }

  return (
    <Shell active="story">
      <StoryRoom
        sessionId={sessionId}
        story={story}
        players={characters}
        initialMessages={messages}
        initialState={initialState as StoryRoomInitialState}
      />
    </Shell>
  );
}
