import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { PlayRoom } from "./room";
import { getGlobalSettings } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ p?: string; t?: string }>;
}) {
  const { sessionId } = await params;
  const sp = await searchParams;
  const db = getDb();
  const session = db.prepare<string, { id: string; story_id: string; state_json: string }>(
    "SELECT id, story_id, state_json FROM session WHERE id = ?"
  ).get(sessionId);
  if (!session) notFound();

  const locale = getGlobalSettings().locale;
  const story = db.prepare<string, { title: string; mode: string }>("SELECT title, mode FROM story WHERE id = ?").get(session.story_id);

  const players = db
    .prepare<string, { player_id: string; character_id: string; token: string }>(
      "SELECT player_id, character_id, token FROM session_player WHERE session_id = ?"
    )
    .all(sessionId);

  const enriched = players.map((p) => {
    const c = db
      .prepare<string, { name: string; class: string | null; race: string | null; level: number; data_json: string }>(
        "SELECT name, class, race, level, data_json FROM character WHERE id = ?"
      )
      .get(p.character_id);
    return { ...p, character: c ? { name: c.name, class: c.class, race: c.race, level: c.level, data: JSON.parse(c.data_json) } : null };
  });

  let initialCombat = false;
  try {
    const st = JSON.parse(session.state_json) as { combat?: boolean };
    initialCombat = st.combat === true;
  } catch {}

  return (
    <PlayRoom
      sessionId={sessionId}
      storyTitle={story?.title ?? t(locale, "play.fallbackStoryTitle")}
      storyMode={story?.mode === "assistant" ? "assistant" : "auto"}
      players={enriched}
      initialPlayerId={sp.p}
      initialToken={sp.t}
      initialCombat={initialCombat}
    />
  );
}
