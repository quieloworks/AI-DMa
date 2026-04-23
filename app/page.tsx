import Link from "next/link";
import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { parseCharacterCardPlayStatus } from "@/lib/characterCardStatus";
import { LibraryGrid, type LibraryStory, type LibraryCharacter } from "./library";

export const dynamic = "force-dynamic";

type CharacterRow = {
  id: string;
  name: string;
  class: string | null;
  race: string | null;
  level: number;
  portrait: string | null;
  data_json: string;
};

type StoryRow = {
  id: string;
  title: string;
  mode: string;
  summary: string | null;
  updated_at: number;
};

export default function HomePage() {
  const db = getDb();
  const characters = db
    .prepare<[], CharacterRow>(
      "SELECT id, name, class, race, level, portrait, data_json FROM character ORDER BY updated_at DESC LIMIT 20"
    )
    .all();
  const storyRows = db
    .prepare<[], StoryRow>(
      "SELECT id, title, mode, summary, updated_at FROM story ORDER BY updated_at DESC LIMIT 20"
    )
    .all();

  const stories: LibraryStory[] = storyRows.map((s) => {
    const sess = db
      .prepare<string, { id: string; turn: number; updated_at: number }>(
        "SELECT id, turn, updated_at FROM session WHERE story_id = ? ORDER BY updated_at DESC LIMIT 1"
      )
      .get(s.id);
    const playerCount = sess
      ? db
          .prepare<string, { n: number }>("SELECT COUNT(*) as n FROM session_player WHERE session_id = ?")
          .get(sess.id)?.n ?? 0
      : 0;
    return {
      id: s.id,
      title: s.title,
      mode: s.mode,
      summary: s.summary,
      updatedAt: s.updated_at,
      sessionId: sess?.id ?? null,
      turn: sess?.turn ?? 0,
      playerCount,
    };
  });

  const charactersForGrid: LibraryCharacter[] = characters.map((c) => {
    const play = parseCharacterCardPlayStatus(c.data_json);
    return {
      id: c.id,
      name: c.name,
      class: c.class,
      race: c.race,
      level: c.level,
      portrait: c.portrait ?? play.portraitFromData,
      hpCurrent: play.hpCurrent,
      hpMax: play.hpMax,
      hpTemp: play.hpTemp,
      ac: play.ac,
    };
  });

  const tr = serverT;
  return (
    <Shell active="home">
      <section
        className="relative mb-16 overflow-hidden rounded-xl mesh-bg grain"
        style={{ border: "0.5px solid var(--color-border)" }}
      >
        <div className="relative grid grid-cols-1 gap-12 px-10 py-16 lg:grid-cols-[1.6fr_1fr]">
          <div className="stagger max-w-2xl">
            <span className="badge mb-6">{tr("home.badge")}</span>
            <h1 className="mb-6" style={{ fontFamily: "var(--font-display)" }}>
              {tr("home.hero1")}{" "}
              <em style={{ color: "var(--color-accent)" }}>{tr("home.hero2")}</em>,
              <br />
              {tr("home.hero3")}
            </h1>
            <p className="mb-8 max-w-xl" style={{ color: "var(--color-text-secondary)", fontSize: 17 }}>
              {tr("home.lead")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/story/new" className="btn-accent">
                {tr("home.cta.story")}
              </Link>
              <Link href="/character/new" className="btn-ghost">
                {tr("home.cta.character")}
              </Link>
            </div>
          </div>
          <div className="hidden lg:block">
            <Compass />
          </div>
        </div>
      </section>

      <LibraryGrid stories={stories} characters={charactersForGrid} />
    </Shell>
  );
}

function Compass() {
  return (
    <div className="relative flex h-full items-center justify-center">
      <svg viewBox="0 0 240 240" className="h-64 w-64 animate-[spin_60s_linear_infinite]">
        <circle cx="120" cy="120" r="110" fill="none" stroke="var(--color-border-strong)" strokeWidth="0.5" />
        <circle cx="120" cy="120" r="80" fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
        <circle cx="120" cy="120" r="50" fill="none" stroke="var(--color-border)" strokeWidth="0.5" />
        {Array.from({ length: 12 }).map((_, i) => {
          const a = (i * Math.PI * 2) / 12;
          const x1 = 120 + Math.cos(a) * 110;
          const y1 = 120 + Math.sin(a) * 110;
          const x2 = 120 + Math.cos(a) * 95;
          const y2 = 120 + Math.sin(a) * 95;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-border-strong)" strokeWidth="0.5" />;
        })}
        <polygon points="120,40 125,120 120,110 115,120" fill="var(--color-accent)" />
      </svg>
    </div>
  );
}
