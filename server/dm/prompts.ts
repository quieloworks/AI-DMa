import type { RetrievedChunk } from "../rag";
import type { AdventureChunk } from "../adventure";
import type { AppLocale } from "@/lib/i18n/locale";
import { normalizeLocale } from "@/lib/i18n/locale";
import { getDmLocaleBlocks } from "./prompt-locale-bundle";

/** Estado táctico persistido (alineado con battle_map en acciones y en UI). */
export type SessionBattleMap = {
  terrain?: string;
  grid: { cols: number; rows: number; cellFeet?: number };
  participants: Array<{
    id: string;
    name: string;
    kind: string;
    x: number;
    y: number;
    hp?: { current: number; max: number };
    status?: string[];
    /** Notas de temperamento / motivación (solo JSON servidor); no revelar literalmente al grupo. */
    dm_personality?: string;
  }>;
  obstacles?: Array<{ x: number; y: number; w?: number; h?: number; kind?: string }>;
};

export type { CombatTrackerPhase, SessionCombatTracker } from "@/lib/session-combat-tracker";
export { coerceCombatTracker } from "@/lib/session-combat-tracker";
import type { CombatTrackerPhase, SessionCombatTracker } from "@/lib/session-combat-tracker";

export type SessionSnapshot = {
  storyTitle: string;
  mode: "auto" | "assistant";
  turn: number;
  summary?: string;
  players: Array<{
    id: string;
    name: string;
    class: string;
    race: string;
    level: number;
    /** XP total acumulado en ficha (PHB); la app recalcula nivel al aplicar xp_awards. */
    xp?: number;
    hp: { current: number; max: number; temp: number };
    ac: number;
    notableItems: string[];
    statusEffects: string[];
    equipment?: Array<{ name: string; qty: number }>;
    spellsKnown?: Array<{ name: string; level: number; prepared?: boolean }>;
    spellSlots?: Record<string, { max: number; used: number }>;
    /** Competencias de ficha (PHB): candados para armas, armaduras y herramientas. */
    proficiencies?: {
      armor: string[];
      weapons: string[];
      tools: string[];
      languages?: string[];
    };
  }>;
  sceneTags?: string[];
  recentLog?: string[];
  tone?: number;
  difficulty?: Difficulty;
  initiative?: Array<{ player_id: string; value: number }>;
  openingDone?: boolean;
  seed?: string;
  adventureOutline?: string | null;
  adventureChunks?: AdventureChunk[];
  adventureSourceName?: string | null;
  /** Sesión en combate (persistido en state_json). */
  combat?: boolean;
  /** Mapa de batalla actual; la fuente de verdad para posiciones y obstáculos durante el combate. */
  battleMap?: SessionBattleMap | null;
  /** Reloj estricto de combate (ronda, iniciativa, fase dentro del turno). */
  combatTracker?: SessionCombatTracker | null;
  /** DM prompt language (matches global app locale). */
  locale?: AppLocale;
};

export type Difficulty = "facil" | "medio" | "dificil" | "experto";

export const DIFFICULTY_OPTIONS: Difficulty[] = ["facil", "medio", "dificil", "experto"];

export function normalizeDifficulty(raw: unknown): Difficulty {
  if (raw === "facil" || raw === "medio" || raw === "dificil" || raw === "experto") return raw;
  return "medio";
}

export type TurnAction =
  | { kind: "opening" }
  | { kind: "continue"; recentSignals?: string[] }
  | { kind: "player"; playerName: string; text: string; sceneInfoRequest?: boolean };

/** Límites de caracteres por chunk al inyectar RAG en el system prompt. */
export type DmRagRenderCaps = {
  rulesChunkChars: number;
  adventureChunkChars: number;
};

export const DEFAULT_DM_RAG_RENDER_CAPS: DmRagRenderCaps = {
  rulesChunkChars: 900,
  adventureChunkChars: 1200,
};

function mergeRagCaps(partial?: Partial<DmRagRenderCaps>): DmRagRenderCaps {
  return {
    rulesChunkChars: partial?.rulesChunkChars ?? DEFAULT_DM_RAG_RENDER_CAPS.rulesChunkChars,
    adventureChunkChars: partial?.adventureChunkChars ?? DEFAULT_DM_RAG_RENDER_CAPS.adventureChunkChars,
  };
}

export function renderRulesContextForPrompt(
  chunks: RetrievedChunk[],
  caps: DmRagRenderCaps,
  locale?: AppLocale,
): string {
  const L = getDmLocaleBlocks(locale);
  if (!chunks.length) return L.emptyRules;
  const max = Math.max(120, caps.rulesChunkChars);
  return chunks
    .map(
      (c, i) =>
        `[R${i + 1} · ${c.section}${c.subsection ? " / " + c.subsection : ""} · p.${c.page}]\n${c.text.slice(0, max)}`
    )
    .join("\n\n");
}

export function renderAdventureChunksForPrompt(
  chunks: AdventureChunk[] | undefined,
  caps: DmRagRenderCaps,
  locale?: AppLocale,
): string {
  const L = getDmLocaleBlocks(locale);
  if (!chunks || !chunks.length) return L.emptyAdventureChunks;
  const max = Math.max(120, caps.adventureChunkChars);
  return chunks
    .map(
      (c, i) =>
        `[A${i + 1}${c.subsection ? " · " + c.subsection.slice(0, 80) : ""} · p.${c.page}]\n${c.text.slice(0, max)}`
    )
    .join("\n\n");
}

function sliceJoin(items: string[], max: number, sep = ", "): string {
  if (!items.length) return "";
  const shown = items.slice(0, max);
  const tail = items.length > max ? `${sep}… (+${items.length - max})` : "";
  return shown.join(sep) + tail;
}

function renderPlayers(p: SessionSnapshot["players"], locale: AppLocale | undefined): string {
  const L = getDmLocaleBlocks(locale);
  const lv = normalizeLocale(locale) === "en" ? "lv" : "nv";
  return p
    .map((x) => {
      const xpPart =
        typeof x.xp === "number" && Number.isFinite(x.xp) ? ` · XP ${Math.floor(x.xp)}` : "";
      const head = `- [${x.id}] ${x.name} (${x.race} ${x.class} ${L.levelAbbr}${x.level})${xpPart} · ${L.hpLabel} ${x.hp.current}/${x.hp.max}${x.hp.temp ? ` (+${x.hp.temp} ${L.tempHp})` : ""} · ${L.acLabel} ${x.ac}${x.statusEffects.length ? ` · [${x.statusEffects.join(", ")}]` : ""}`;
      const eq = x.equipment?.length
        ? `\n    ${L.equipment} ${x.equipment
            .slice(0, 12)
            .map((e) => (e.qty > 1 ? `${e.qty}× ${e.name}` : e.name))
            .join(", ")}`
        : "";
      const spells = x.spellsKnown?.length
        ? `\n    ${L.spells} ${x.spellsKnown
            .slice(0, 10)
            .map((s) => `${s.name}(${lv}${s.level}${s.prepared ? "✓" : ""})`)
            .join(", ")}`
        : "";
      const slots = x.spellSlots && Object.keys(x.spellSlots).length
        ? `\n    ${L.slots} ${Object.entries(x.spellSlots)
            .map(([lvl, s]) => `${lv}${lvl} ${s.max - s.used}/${s.max}`)
            .join(", ")}`
        : "";
      const pr = x.proficiencies;
      let profLine = "";
      if (pr && (pr.armor.length || pr.weapons.length || pr.tools.length || (pr.languages?.length ?? 0))) {
        const bits: string[] = [];
        if (pr.armor.length) bits.push(`${L.profArmor} ${sliceJoin(pr.armor, 8)}`);
        if (pr.weapons.length) bits.push(`${L.profWeapons} ${sliceJoin(pr.weapons, 10)}`);
        if (pr.tools.length) bits.push(`${L.profTools} ${sliceJoin(pr.tools, 8)}`);
        if (pr.languages?.length) bits.push(`${L.profLanguages} ${sliceJoin(pr.languages, 6)}`);
        profLine = `\n    ${L.proficiencies} ${bits.join(" · ")}`;
      }
      return head + eq + spells + slots + profLine;
    })
    .join("\n");
}

function initiativeDisplayName(snap: SessionSnapshot, playerId: string): string {
  const pj = snap.players.find((p) => p.id === playerId);
  if (pj) return pj.name;
  const tok = snap.battleMap?.participants?.find((p) => p.id === playerId);
  if (tok) return `${tok.name} [${tok.kind}]`;
  return playerId;
}

function renderInitiative(snap: SessionSnapshot): string {
  if (!snap.initiative?.length) return "";
  const L = getDmLocaleBlocks(snap.locale);
  const sorted = [...snap.initiative].sort((a, b) => b.value - a.value);
  return `${L.initiativeHeading} ${sorted.map((i) => `${initiativeDisplayName(snap, i.player_id)}=${i.value}`).join(" → ")}`;
}

function combatPhaseLabelLocalized(phase: CombatTrackerPhase, locale: AppLocale | undefined): string {
  const es: Record<CombatTrackerPhase, string> = {
    initiative: "iniciativa (orden antes del primer turno)",
    awaiting_dice: "esperando tirada obligatoria para cerrar un paso mecánico",
    same_turn_resolution:
      "cerrando el mismo turno (p. ej. daño tras impacto, salvaciones del mismo ataque)",
    turn_open: "turno activo: el actor puede declarar movimiento/acción sin dado bloqueante pendiente",
    player_movement: "declaración de movimiento en mapa (PJ coloca ficha en la app antes de acción/ataque)",
    between_actors: "puente narrativo entre combatientes (no consumas aún el turno del siguiente)",
  };
  const en: Record<CombatTrackerPhase, string> = {
    initiative: "initiative (ordering before the first turn)",
    awaiting_dice: "waiting on a mandatory roll to finish a mechanical step",
    same_turn_resolution:
      "resolving the same turn (e.g. damage after a hit, saves from the same attack)",
    turn_open: "active turn: the actor may declare movement/action with no blocking roll pending",
    player_movement: "map movement declaration (PC places token in the app before action/attack)",
    between_actors: "brief narrative bridge between combatants (do not advance the next turn yet)",
  };
  const map = normalizeLocale(locale) === "en" ? en : es;
  return map[phase] ?? phase;
}

function renderCombatTracker(snap: SessionSnapshot): string {
  const L = getDmLocaleBlocks(snap.locale);
  const t = snap.combatTracker;
  if (!t || !isCombatWorkflow(snap)) return "";
  const sorted = snap.initiative?.length ? [...snap.initiative].sort((a, b) => b.value - a.value) : [];
  const ordered = sorted.map((i) => `${initiativeDisplayName(snap, i.player_id)}=${i.value}`).join(" → ");
  const cur = initiativeDisplayName(snap, t.turn_of);
  const nextLine =
    sorted.length && t.initiative_index + 1 < sorted.length
      ? `${L.combatNextInit} ${initiativeDisplayName(snap, sorted[t.initiative_index + 1]!.player_id)}.`
      : sorted.length
        ? L.combatRoundWrap
        : "";
  return [
    L.combatClockTitle,
    `${L.combatRoundPrefix} ${t.round}${L.combatPhaseMid} ${combatPhaseLabelLocalized(t.phase, snap.locale)} [phase=${t.phase}]`,
    `${L.combatActorBlocks} ${cur} (turn_of=${t.turn_of}) · initiative_index=${t.initiative_index} ${L.initiativeIndexHint}`,
    L.combatStrictTurnReminder,
    t.note ? `${L.combatPendingExplicit} ${t.note}` : L.combatPendingGeneric,
    sorted.length ? `${L.combatQueueComplete} ${ordered}` : L.combatQueueMissing,
    nextLine,
  ].join("\n");
}

function renderBattleMapSummary(snap: SessionSnapshot): string {
  const L = getDmLocaleBlocks(snap.locale);
  const bm = snap.battleMap;
  if (!bm?.grid) return "";
  const cf = bm.grid.cellFeet ?? 5;
  const feetWord = normalizeLocale(snap.locale) === "en" ? "ft" : "pies";
  const head = `${L.battleMapIntro}${bm.terrain ?? "—"} · grid ${bm.grid.cols}×${bm.grid.rows} cells (~${cf} ${feetWord}/cell)`;
  const parts = (bm.participants ?? [])
    .slice(0, 28)
    .map((p) => {
      const hp =
        p.hp !== undefined ? ` ${L.hpLabel}${p.hp.current}/${p.hp.max}` : "";
      const st = p.status?.length ? ` [${p.status.join(", ")}]` : "";
      return `${p.name}(${p.id}·${p.kind}) @(${p.x},${p.y})${hp}${st}`;
    });
  const obs = (bm.obstacles ?? []).slice(0, 20).map((o) => {
    const w = o.w ?? 1;
    const h = o.h ?? 1;
    return `(${o.x},${o.y})${w}×${h}${o.kind ? ` ${o.kind}` : ""}`;
  });
  const tailP = (bm.participants?.length ?? 0) > 28 ? ` …+${(bm.participants?.length ?? 0) - 28} ${L.moreSuffix}` : "";
  const tailO = (bm.obstacles?.length ?? 0) > 20 ? ` …+${(bm.obstacles?.length ?? 0) - 20}` : "";
  const personalityLines = (bm.participants ?? [])
    .filter((p) => p.kind !== "player" && typeof p.dm_personality === "string" && p.dm_personality.trim())
    .map((p) => `- ${p.name} (${p.id}·${p.kind}): ${p.dm_personality!.trim()}`);
  const personalityBlock =
    personalityLines.length > 0
      ? `\n${L.npcPersonalityHeading}\n${personalityLines.join("\n")}\n${L.npcPersonalityFooter}`
      : "";
  return [
    head,
    `${L.participantsLabel} ${parts.join("; ")}${tailP}`,
    obs.length ? `${L.obstaclesLabel} ${obs.join("; ")}${tailO}` : "",
    personalityBlock,
    L.battleMapNarratorNote,
  ]
    .filter(Boolean)
    .join("\n");
}

function isCombatWorkflow(snap: SessionSnapshot): boolean {
  return snap.combat === true || Boolean(snap.initiative?.length);
}

function difficultyGuide(
  difficulty: Difficulty | undefined,
  locale: AppLocale | undefined,
): { label: string; directive: string } {
  const d = normalizeDifficulty(difficulty);
  const en = normalizeLocale(locale) === "en";
  if (d === "facil") {
    return en
      ? {
          label: "Easy",
          directive:
            "DIFFICULTY Easy: DC 8–11, enemy attacks +3/+4, saves DC 10–11; few enemies; simple tactics; generous clues/recovery; avoid dropping to 0 HP unless repeated failures.",
        }
      : {
          label: "Fácil",
          directive:
            "DIFICULTAD Fácil: CD habilidad 8-11, ataques enemigos +3/+4, salv CD 10-11; pocos enemigos, tácticas simples; pistas y recuperación generosas; evita bajar a 0 HP salvo fallos repetidos.",
        };
  }
  if (d === "dificil") {
    return en
      ? {
          label: "Hard",
          directive:
            "DIFFICULTY Hard: DC 15–18, attacks +6/+8, saves DC 14–16; hard DMG encounters; optimal tactics; hostile environment; little free info; 0 HP possible with strict rules.",
        }
      : {
          label: "Difícil",
          directive:
            "DIFICULTAD Difícil: CD habilidad 15-18, ataques +6/+8, salv CD 14-16; encuentros duros DMG, tácticas óptimas, entorno hostil; poca info gratis; 0 HP posible con reglas estrictas.",
        };
  }
  if (d === "experto") {
    return en
      ? {
          label: "Expert",
          directive:
            "DIFFICULTY Expert: DC 17–22, attacks +8/+11, saves DC 16–19; deadly DMG limits; coordinated enemies (focus fire, control); scarce resources; permanent death possible; no soft rules.",
        }
      : {
          label: "Experto",
          directive:
            "DIFICULTAD Experto: CD 17-22, ataques +8/+11, salv CD 16-19; límite mortal DMG; enemigos coordinados (concentración, control); recursos escasos; muerte permanente posible; reglas sin suavizar.",
        };
  }
  return en
    ? {
        label: "Medium",
        directive:
          "DIFFICULTY Medium (5E): DC 12–14, attacks +5/+6, saves DC 13; medium/hard DMG encounters occasionally; sensible tactics with exploitable mistakes; challenge without cheap punishment.",
      }
    : {
        label: "Medio",
        directive:
          "DIFICULTAD Medio (5E): CD habilidad 12-14, ataques +5/+6, salv CD 13; encuentros DMG medio/difícil ocasional; tácticas sensatas con errores aprovechables; reto sin castigo gratuito.",
      };
}

function toneGuide(tone: number | undefined, locale: AppLocale | undefined): { label: string; directive: string } {
  const t = Math.max(0, Math.min(100, tone ?? 50));
  const en = normalizeLocale(locale) === "en";
  if (t <= 15) {
    return en
      ? {
          label: "Strict",
          directive:
            "TONE Strict: Handbook rules to the letter; sober prose; no humor; always use 5E dice where applicable.",
        }
      : {
          label: "Estricto",
          directive: "TONO Estricto: reglas Handbook al pie de la letra; prosa sobria; sin humor; tiradas 5E siempre.",
        };
  }
  if (t <= 35) {
    return en
      ? {
          label: "Serious",
          directive: "TONE Serious: dramatic; strict mechanics; concise descriptions; no gratuitous humor.",
        }
      : {
          label: "Serio",
          directive: "TONO Serio: dramático, mecánica estricta, descripciones breves; sin humor gratuito.",
        };
  }
  if (t <= 55) {
    return en
      ? {
          label: "Balanced",
          directive:
            "TONE Balanced: epic + strict rules; nuanced NPCs; rules exactly as written when resolving outcomes.",
        }
      : {
          label: "Equilibrado",
          directive: "TONO Equilibrado: épico + reglas estrictas; NPCs con matices; reglas siempre como escritas.",
        };
  }
  if (t <= 75) {
    return en
      ? {
          label: "Witty",
          directive: "TONE Witty: color and light irony; rules remain intact when resolving mechanics.",
        }
      : {
          label: "Ocurrente",
          directive: "TONO Ocurrente: color e ironía ligera; reglas intactas en resolución.",
        };
  }
  return en
    ? {
        label: "Whimsical",
        directive: "TONE Whimsical: humor/absurdism (good-natured); rules applied fairly regardless.",
      }
    : {
        label: "Bufonesco",
        directive: "TONO Bufonesco: humor/absurdo amable; reglas justas igualmente aplicadas.",
      };
}

function renderAdventureBlock(snap: SessionSnapshot, caps: DmRagRenderCaps): string {
  const L = getDmLocaleBlocks(snap.locale);
  const hasOutline = Boolean(snap.adventureOutline && snap.adventureOutline.trim());
  const hasChunks = Boolean(snap.adventureChunks && snap.adventureChunks.length);
  if (!hasOutline && !hasChunks) return "";

  const header = `${L.adventureTitle}${snap.adventureSourceName ? ` (${snap.adventureSourceName})` : ""}`;
  const outline = hasOutline ? `\n${L.outlineLabel}\n${snap.adventureOutline!.trim()}` : "";
  const chunks = hasChunks ? `\n${L.fragmentsLabel}\n${renderAdventureChunksForPrompt(snap.adventureChunks, caps, snap.locale)}` : "";
  return `${header}${outline}${chunks}\n${L.adventureDirective}`;
}

function sharedDirectiveTail(snap: SessionSnapshot, includeEngagement: boolean): string {
  const L = getDmLocaleBlocks(snap.locale);
  const combatBlock = isCombatWorkflow(snap) ? L.combatDirectives : L.combatHint;
  const parts: string[] = [L.narrativeVoice, L.actorAgency, L.technicalSceneRule];
  if (includeEngagement) parts.push(L.engagementDirectives);
  parts.push(combatBlock, L.mechanicalDirectives, L.sheetAuthorityLocks, L.resolutionDirective, L.formatBlock);
  return parts.join("\n\n");
}

function baseSystem(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  toneLine: string,
  ragCaps: DmRagRenderCaps
): string {
  const L = getDmLocaleBlocks(snap.locale);
  const init = renderInitiative(snap);
  const mapBlock = renderBattleMapSummary(snap);
  const diff = difficultyGuide(snap.difficulty, snap.locale);
  const diffLine = `${diff.directive}\n(${L.difficultyWord} ${diff.label})`;
  const adventureBlock = renderAdventureBlock(snap, ragCaps);
  return `${L.playersIntro}

${L.storyLabel} ${snap.storyTitle}
${L.modePrefix} ${snap.mode === "auto" ? L.modeAuto : L.modeAssistant}
${L.turnLabel} ${snap.turn}${snap.seed ? `\n${L.seedLabel} ${snap.seed}` : ""}${snap.summary ? `\n${L.summaryLabel} ${snap.summary}` : ""}

${L.playersHeading}
${renderPlayers(snap.players, snap.locale)}
${init ? "\n" + init : ""}
${mapBlock ? "\n" + mapBlock : ""}
${renderCombatTracker(snap) ? "\n" + renderCombatTracker(snap) : ""}

${snap.recentLog?.length ? `${L.recentEvents}\n${snap.recentLog.slice(-8).join("\n")}` : ""}
${adventureBlock ? "\n" + adventureBlock + "\n" : ""}
${L.handbookMechanics}
${renderRulesContextForPrompt(rulesContext, ragCaps, snap.locale)}

${toneLine}

${diffLine}

${sharedDirectiveTail(snap, true)}`;
}

function assistantSystem(snap: SessionSnapshot, rulesContext: RetrievedChunk[], toneLine: string, ragCaps: DmRagRenderCaps): string {
  const L = getDmLocaleBlocks(snap.locale);
  const diff = difficultyGuide(snap.difficulty, snap.locale);
  const adventureBlock = renderAdventureBlock(snap, ragCaps);
  return `${L.assistantIntro}

${L.storyLabel} ${snap.storyTitle}
${L.turnLabel} ${snap.turn}${snap.summary ? `\n${L.ctxLabel} ${snap.summary}` : ""}

${L.playersHeading}
${renderPlayers(snap.players, snap.locale)}
${renderInitiative(snap) ? "\n" + renderInitiative(snap) : ""}
${renderBattleMapSummary(snap) ? "\n" + renderBattleMapSummary(snap) : ""}
${renderCombatTracker(snap) ? "\n" + renderCombatTracker(snap) : ""}

${adventureBlock ? adventureBlock + "\n\n" : ""}${L.handbookAssistant}
${renderRulesContextForPrompt(rulesContext, ragCaps, snap.locale)}

${toneLine}

${diff.directive}\n(${L.difficultyWord} ${diff.label})

${sharedDirectiveTail(snap, false)}

${L.assistantNarrativeHint}`;
}

export function buildOpeningPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  ragCaps: Partial<DmRagRenderCaps> = {}
) {
  const caps = mergeRagCaps(ragCaps);
  const L = getDmLocaleBlocks(snap.locale);
  const { label, directive } = toneGuide(snap.tone, snap.locale);
  const system = baseSystem(
    snap,
    rulesContext,
    `${directive}\n(${L.toneWord}: ${label}, ${snap.tone ?? 50}/100)`,
    caps,
  );

  const names = snap.players.map((p) => `${p.name} (${p.race} ${p.class})`).join(", ");
  const filler = names || L.fillerParty;
  const hasModule = Boolean(
    (snap.adventureOutline && snap.adventureOutline.trim()) ||
      (snap.adventureChunks && snap.adventureChunks.length)
  );
  const moduleDirective = hasModule
    ? L.moduleLoaded.replace("{{names}}", filler)
    : L.moduleSeed;

  const user = `${L.openingUser.replace("{{names}}", filler)}${moduleDirective}`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function buildAutoDmPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  action: TurnAction,
  ragCaps: Partial<DmRagRenderCaps> = {}
) {
  const caps = mergeRagCaps(ragCaps);
  const L = getDmLocaleBlocks(snap.locale);
  const { label, directive } = toneGuide(snap.tone, snap.locale);
  const system = baseSystem(
    snap,
    rulesContext,
    `${directive}\n(${L.toneWord}: ${label}, ${snap.tone ?? 50}/100)`,
    caps,
  );

  let user = "";
  if (action.kind === "opening") {
    return buildOpeningPrompt(snap, rulesContext, caps);
  }
  if (action.kind === "continue") {
    const combatClock =
      snap.combat || snap.initiative?.length
        ? L.continueCombatClock
        : "";
    user = `${L.continueUserIntro}${combatClock}${action.recentSignals?.length ? `\n${L.recentSignals}\n- ${action.recentSignals.join("\n- ")}` : ""}`;
  } else if (action.sceneInfoRequest) {
    user = L.sceneInfoUser.replace(/\{\{player\}\}/g, action.playerName);
  } else {
    user = L.playerTurnUser.replace(/\{\{player\}\}/g, action.playerName).replace("{{text}}", action.text ?? "");
  }

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function buildAssistantDmPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  dmMessage: string,
  ragCaps: Partial<DmRagRenderCaps> = {}
) {
  const caps = mergeRagCaps(ragCaps);
  const L = getDmLocaleBlocks(snap.locale);
  const { label, directive } = toneGuide(snap.tone, snap.locale);
  const system = assistantSystem(
    snap,
    rulesContext,
    `${directive}\n(${L.toneWord}: ${label}, ${snap.tone ?? 50}/100)`,
    caps,
  );

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `${L.assistantDmPrefix} ${dmMessage}` },
  ];
}

export function parseDmResponse(raw: string): {
  narrative: string;
  actions: Record<string, unknown>;
  emotion?: string;
} {
  const narrativa = /<narrativa>([\s\S]*?)<\/narrativa>/i.exec(raw)?.[1]?.trim() ?? raw;
  const acciones = /<acciones>([\s\S]*?)<\/acciones>/i.exec(raw)?.[1]?.trim() ?? "{}";
  const emotion = /\[emocion:([^\]]+)\]/i.exec(narrativa)?.[1]?.trim();
  let actions: Record<string, unknown> = {};
  try {
    actions = JSON.parse(acciones);
  } catch {
    try {
      actions = JSON.parse(acciones.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      actions = {};
    }
  }
  return { narrative: narrativa, actions, emotion };
}
