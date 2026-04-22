"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "@/components/LocaleProvider";

export type LibraryStory = {
  id: string;
  title: string;
  mode: string;
  summary: string | null;
  updatedAt: number;
  sessionId: string | null;
  turn: number;
  playerCount: number;
};

export type LibraryCharacter = {
  id: string;
  name: string;
  class: string | null;
  race: string | null;
  level: number;
  portrait: string | null;
};

export function LibraryGrid({
  stories,
  characters,
}: {
  stories: LibraryStory[];
  characters: LibraryCharacter[];
}) {
  const tr = useTranslations();
  const router = useRouter();
  const [busyStory, setBusyStory] = useState<string | null>(null);
  const [busyChar, setBusyChar] = useState<string | null>(null);

  async function deleteStory(story: LibraryStory) {
    const ok = window.confirm(tr("library.deleteStoryConfirm", { title: story.title }));
    if (!ok) return;
    setBusyStory(story.id);
    try {
      await fetch(`/api/story/${story.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyStory(null);
    }
  }

  async function renameStory(story: LibraryStory) {
    const title = window.prompt(tr("library.renamePrompt"), story.title);
    if (title == null) return;
    const trimmed = title.trim();
    if (!trimmed || trimmed === story.title) return;
    setBusyStory(story.id);
    try {
      await fetch(`/api/story/${story.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      router.refresh();
    } finally {
      setBusyStory(null);
    }
  }

  async function deleteCharacter(ch: LibraryCharacter) {
    const ok = window.confirm(tr("library.deleteCharConfirm", { name: ch.name }));
    if (!ok) return;
    setBusyChar(ch.id);
    try {
      await fetch(`/api/character/${ch.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyChar(null);
    }
  }

  return (
    <>
      <section className="mb-16">
        <div className="mb-6 flex items-end justify-between">
          <h2>{tr("library.stories")}</h2>
          <Link href="/story/new" className="text-sm" style={{ color: "var(--color-accent)" }}>
            {tr("library.newStory")}
          </Link>
        </div>
        {stories.length === 0 ? (
          <EmptyState label={tr("library.emptyStories")} cta={{ href: "/story/new", label: tr("library.createFirst") }} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 stagger">
            {stories.map((s) => {
              const href = s.sessionId ? `/story/${s.sessionId}` : `/story/${s.id}`;
              return (
                <div
                  key={s.id}
                  className="card relative overflow-hidden transition"
                  style={{ opacity: busyStory === s.id ? 0.5 : 1 }}
                >
                  <Link href={href} className="block">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="badge">{s.mode === "auto" ? tr("settings.mode.auto") : tr("settings.mode.assistant")}</span>
                      <span className="text-[11px]" style={{ color: "var(--color-text-hint)" }}>
                        {s.playerCount}{" "}
                        {s.playerCount === 1 ? tr("library.playerOne") : tr("library.playersMany")} · {tr("library.turnWord")}{" "}
                        {s.turn}
                      </span>
                    </div>
                    <h3 className="mb-1">{s.title}</h3>
                    <p className="line-clamp-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                      {s.summary ?? tr("library.noSummary")}
                    </p>
                  </Link>
                  <div className="mt-4 flex items-center gap-2">
                    <Link href={href} className="btn-ghost" style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}>
                      {tr("library.open")}
                    </Link>
                    <button
                      className="btn-ghost"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                      onClick={() => renameStory(s)}
                      disabled={busyStory === s.id}
                    >
                      {tr("library.rename")}
                    </button>
                    <button
                      className="btn-ghost"
                      style={{ padding: "6px 10px", fontSize: 12, color: "var(--color-accent)" }}
                      onClick={() => deleteStory(s)}
                      disabled={busyStory === s.id}
                    >
                      {tr("library.deleteShort")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2>{tr("library.characters")}</h2>
          <Link href="/character/new" className="text-sm" style={{ color: "var(--color-accent)" }}>
            {tr("library.newCharacter")}
          </Link>
        </div>
        {characters.length === 0 ? (
          <EmptyState label={tr("library.noCharsYet")} cta={{ href: "/character/new", label: tr("library.createCharacter") }} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 stagger">
            {characters.map((c) => (
              <div key={c.id} className="card transition" style={{ opacity: busyChar === c.id ? 0.5 : 1 }}>
                <Link href={`/character/${c.id}`} className="block">
                  <div className="mb-3 h-20 w-20 rounded-md" style={{ background: "var(--color-bg-tertiary)" }}>
                    {c.portrait ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.portrait} alt={c.name} className="h-full w-full rounded-md object-cover" />
                    ) : null}
                  </div>
                  <h3 className="mb-0.5">{c.name}</h3>
                  <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                    {c.race ?? tr("common.empty")} · {c.class ?? tr("common.empty")} · {tr("library.level")} {c.level}
                  </p>
                </Link>
                <div className="mt-3 flex gap-2">
                  <Link
                    href={`/character/${c.id}/edit`}
                    className="btn-ghost"
                    style={{ flex: 1, padding: "6px 10px", fontSize: 12 }}
                  >
                    {tr("library.edit")}
                  </Link>
                  <button
                    className="btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 12, color: "var(--color-accent)" }}
                    onClick={() => deleteCharacter(c)}
                    disabled={busyChar === c.id}
                  >
                    {tr("library.deleteShort")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function EmptyState({ label, cta }: { label: string; cta: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-start gap-4 p-8">
      <p style={{ color: "var(--color-text-secondary)" }}>{label}</p>
      <Link href={cta.href} className="btn-ghost">
        {cta.label}
      </Link>
    </div>
  );
}
