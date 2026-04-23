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
  hpCurrent: number | null;
  hpMax: number | null;
  hpTemp: number | null;
  ac: number | null;
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
                  <div className="flex gap-3">
                    <CharacterAvatar name={c.name} portraitUrl={c.portrait} />
                    <div className="min-w-0 flex-1">
                      <h3 className="mb-0.5 leading-tight">{c.name}</h3>
                      <p className="text-xs leading-snug" style={{ color: "var(--color-text-hint)" }}>
                        {c.race ?? tr("common.empty")} · {c.class ?? tr("common.empty")} · {tr("library.level")} {c.level}
                      </p>
                      <CharacterCardStatus c={c} tr={tr} />
                    </div>
                  </div>
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

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  const one = parts[0] ?? "?";
  return one.slice(0, 2).toUpperCase();
}

function CharacterAvatar({ name, portraitUrl }: { name: string; portraitUrl: string | null }) {
  const initials = initialsFromName(name);
  return (
    <div
      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full"
      style={{
        background: "var(--color-bg-tertiary)",
        border: "0.5px solid var(--color-border-strong)",
        boxShadow: "0 0 0 1px color-mix(in srgb, var(--color-bg-primary) 40%, transparent)",
      }}
    >
      {portraitUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={portraitUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-xs font-medium"
          style={{ color: "var(--color-accent-text)", fontFamily: "var(--font-display)" }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

function CharacterCardStatus({
  c,
  tr,
}: {
  c: LibraryCharacter;
  tr: (path: string, vars?: Record<string, string | number>) => string;
}) {
  const hasHp = c.hpCurrent != null && c.hpMax != null;
  const hasAc = c.ac != null;
  const hasTemp = c.hpTemp != null && c.hpTemp > 0;
  const showHpRow = hasHp || hasTemp;
  if (!showHpRow && !hasAc) {
    return (
      <p className="mt-2 text-[11px] leading-snug" style={{ color: "var(--color-text-hint)" }}>
        {tr("library.cardNoPlayData")}
      </p>
    );
  }

  let hpRatio: number | null = null;
  let lowHp = false;
  if (hasHp && c.hpMax! > 0) {
    hpRatio = Math.min(1, Math.max(0, c.hpCurrent! / c.hpMax!));
    lowHp = hpRatio < 0.25;
  }

  return (
    <div className="mt-2 space-y-1.5">
      {showHpRow ? (
        <>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
            {hasHp ? (
              <span style={{ color: lowHp ? "var(--color-accent-text)" : undefined }}>
                {tr("library.cardHp", { current: c.hpCurrent!, max: c.hpMax! })}
              </span>
            ) : null}
            {hasTemp ? (
              <span className="rounded px-1.5 py-px" style={{ background: "var(--color-accent-bg)", color: "var(--color-accent-text)" }}>
                {tr("library.cardTempHp", { n: c.hpTemp! })}
              </span>
            ) : null}
          </div>
          {hpRatio != null ? (
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "var(--color-border)" }}>
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{
                  width: `${Math.round(hpRatio * 100)}%`,
                  background: lowHp ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text-secondary) 55%, var(--color-accent) 45%)",
                }}
              />
            </div>
          ) : null}
        </>
      ) : null}
      {hasAc ? (
        <p className="text-[11px] font-medium" style={{ color: "var(--color-text-secondary)" }}>
          {tr("library.cardAc", { ac: c.ac! })}
        </p>
      ) : null}
    </div>
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
