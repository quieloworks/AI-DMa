"use client";

import type { BattleMap } from "@/lib/battle-map-types";
import type { InitiativeEntry } from "@/lib/combat-turn";
import type { SessionCombatTracker } from "@/lib/session-combat-tracker";
import { rotatedInitiativeOrderFromTracker } from "@/lib/initiative-queue";
import { useTranslations } from "@/components/LocaleProvider";

/** Colores coherentes con tokens del mapa táctico (`app/story/[id]/map.tsx`). */
const KIND_STYLES: Record<
  "player" | "ally" | "enemy" | "neutral",
  { accent: string; muted: string }
> = {
  player: { accent: "#378add", muted: "rgba(55,138,221,0.35)" },
  ally: { accent: "#63c07b", muted: "rgba(99,192,123,0.35)" },
  enemy: { accent: "#d85a30", muted: "rgba(216,90,48,0.35)" },
  neutral: { accent: "#cfa33a", muted: "rgba(207,163,58,0.35)" },
};

type MinimalPlayer = { playerId: string; character: { name: string } | null };

export function InitiativeQueuePanel({
  initiative,
  combatTracker,
  battleMap,
  playersById,
  variant = "sidebar",
}: {
  initiative: InitiativeEntry[];
  combatTracker: SessionCombatTracker | null;
  battleMap: BattleMap | null;
  playersById: Record<string, MinimalPlayer | undefined>;
  variant?: "sidebar" | "compact";
}) {
  const tr = useTranslations();

  if (!initiative.length || !combatTracker) return null;

  const queue = rotatedInitiativeOrderFromTracker(initiative, combatTracker);
  const compact = variant === "compact";

  function displayName(playerId: string): string {
    const pj = playersById[playerId]?.character?.name;
    if (pj) return pj;
    const tok = battleMap?.participants?.find((p) => p.id === playerId);
    if (tok) return `${tok.name}${tok.kind !== "player" ? ` [${tok.kind}]` : ""}`;
    return playerId;
  }

  function kindFor(playerId: string): keyof typeof KIND_STYLES | null {
    const tok = battleMap?.participants?.find((p) => p.id === playerId);
    return tok?.kind ?? null;
  }

  return (
    <aside
      className={
        compact
          ? "mb-2 shrink-0 rounded-md px-2 py-2 text-xs"
          : "mb-3 w-full shrink-0 rounded-lg px-3 py-3 lg:mb-0 lg:w-[260px] lg:overflow-y-auto lg:py-3"
      }
      style={{
        border: "0.5px solid var(--color-border)",
        background: "var(--color-bg-tertiary)",
        maxHeight: compact ? undefined : "min(70vh, 560px)",
      }}
      aria-label={tr("initiativeQueue.a11yLabel")}
    >
      <div className={compact ? "space-y-1.5" : "space-y-2"}>
        <div className="flex flex-wrap items-baseline justify-between gap-1">
          <p
            className="font-medium"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: compact ? 12 : 14,
              color: "var(--color-text-primary)",
            }}
          >
            {tr("initiativeQueue.title")}
          </p>
          <span style={{ color: "var(--color-text-hint)", fontSize: compact ? 11 : 12 }}>
            {tr("initiativeQueue.round", { n: combatTracker.round })}
          </span>
        </div>
        <ol className={`m-0 list-none p-0 ${compact ? "space-y-1" : "space-y-1.5"}`}>
          {queue.map((row, i) => {
            const active = row.player_id === combatTracker.turn_of;
            const kind = kindFor(row.player_id);
            const ks = kind ? KIND_STYLES[kind] : null;
            return (
              <li
                key={`${row.player_id}-${row.value}-${i}`}
                className="rounded-md px-2 py-1.5 transition-colors"
                style={{
                  borderLeft: active ? `3px solid ${ks?.accent ?? "var(--color-accent)"}` : "3px solid transparent",
                  background: active
                    ? ks
                      ? `linear-gradient(90deg, ${ks.muted}, transparent)`
                      : "rgba(127,119,221,0.12)"
                    : undefined,
                  paddingLeft: compact ? 8 : 10,
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span style={{ color: "var(--color-text-primary)", fontSize: compact ? 11 : 13 }}>
                    <span style={{ color: "var(--color-text-hint)", marginRight: 6 }}>{i + 1}.</span>
                    {displayName(row.player_id)}
                    {active && (
                      <span className="ml-1.5 rounded px-1 py-0.5 text-[10px]" style={{ background: "rgba(216,90,48,0.18)", color: "#e8a889" }}>
                        {tr("initiativeQueue.active")}
                      </span>
                    )}
                  </span>
                  <span style={{ color: "var(--color-text-secondary)", fontSize: compact ? 10 : 12, whiteSpace: "nowrap" }}>
                    {tr("initiativeQueue.roll", { n: row.value })}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
