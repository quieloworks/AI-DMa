import { NextRequest } from "next/server";
import { chatStream } from "@/server/providers/chat";
import { getDb } from "@/lib/db";
import {
  buildAutoDmPrompt,
  buildAssistantDmPrompt,
  coerceCombatTracker,
  parseDmResponse,
  normalizeDifficulty,
  type Difficulty,
  type SessionCombatTracker,
  type SessionSnapshot,
  type TurnAction,
} from "@/server/dm/prompts";
import { retrieveRules } from "@/server/rag";
import { retrieveAdventure, getAdventureOutline, hasAdventure } from "@/server/adventure";
import { applyDmActions } from "@/server/dm/apply-actions";
import { getDmRagBudget } from "@/server/dm/prompt-budget";
import { getIo } from "@/server/io-bus";
import type { AppLocale } from "@/lib/i18n/locale";
import { getGlobalSettings } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/t";

export const runtime = "nodejs";

function llmErrorMessage(err: unknown, locale: AppLocale): string {
  const e = err as Error & { cause?: NodeJS.ErrnoException & { address?: string; port?: number } };
  const c = e?.cause;
  if (c && typeof c === "object" && "code" in c && c.code === "ECONNREFUSED") {
    if (c.port === 11434) {
      return t(locale, "errors.llmOllama");
    }
    return t(locale, "errors.llmConn", {
      host: String(c.address ?? "server"),
      port: String(c.port ?? "?"),
    });
  }
  return e?.message ?? String(err);
}

type ChatReq = {
  sessionId: string;
  mode: "auto" | "assistant";
  action?: "player" | "continue" | "opening";
  playerId?: string;
  playerName?: string;
  text?: string;
  /** Petición explícita de descripción de escena + terreno (combate); no mezclar con narrativa normal. */
  sceneInfoRequest?: boolean;
  tone?: number;
  difficulty?: Difficulty | string;
  clientId?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatReq;
  const db = getDb();
  const locale = getGlobalSettings().locale;

  const sessionRow = db
    .prepare<string, { id: string; story_id: string; state_json: string; turn: number }>(
      "SELECT id, story_id, state_json, turn FROM session WHERE id = ?"
    )
    .get(body.sessionId);
  if (!sessionRow) return new Response(t(locale, "errors.sessionNotFound"), { status: 404 });

  const storyRow = db
    .prepare<string, { title: string; summary: string | null; data_json: string; source_pdf: string | null }>(
      "SELECT title, summary, data_json, source_pdf FROM story WHERE id = ?"
    )
    .get(sessionRow.story_id);

  type BattleParticipant = {
    id: string;
    name: string;
    kind: "player" | "ally" | "enemy" | "neutral";
    x: number;
    y: number;
    hp?: { current: number; max: number };
    status?: string[];
  };
  type BattleMap = {
    terrain?: string;
    grid: { cols: number; rows: number; cellFeet?: number };
    participants: BattleParticipant[];
    obstacles?: Array<{ x: number; y: number; w?: number; h?: number; kind?: string }>;
  };
  type PersistedState = {
    players?: Array<{ id: string; statusEffects?: string[] }>;
    summary?: string;
    recentLog?: string[];
    sceneTags?: string[];
    sceneImage?: string;
    coverImage?: string;
    tone?: number;
    difficulty?: Difficulty;
    openingDone?: boolean;
    initiative?: Array<{ player_id: string; value: number }>;
    combat?: boolean;
    battleMap?: BattleMap | null;
    combatTracker?: SessionCombatTracker | null;
  };

  let state: PersistedState = {};
  try {
    state = JSON.parse(sessionRow.state_json) as PersistedState;
  } catch {}

  if (typeof body.tone === "number" && Number.isFinite(body.tone)) {
    state.tone = Math.max(0, Math.min(100, Math.round(body.tone)));
  }
  if (typeof body.difficulty === "string") {
    state.difficulty = normalizeDifficulty(body.difficulty);
  }

  const playerIds = db
    .prepare<string, { character_id: string; player_id: string }>(
      "SELECT player_id, character_id FROM session_player WHERE session_id = ?"
    )
    .all(body.sessionId);

  const players = playerIds.map((p) => {
    const ch = db
      .prepare<string, { name: string; data_json: string; level: number; class: string | null; race: string | null }>(
        "SELECT name, data_json, level, class, race FROM character WHERE id = ?"
      )
      .get(p.character_id);
    const data = ch ? (JSON.parse(ch.data_json) as Record<string, unknown>) : {};
    const hp = (data.hp as { current?: number; max?: number; temp?: number }) ?? { current: 10, max: 10, temp: 0 };
    const equipment = (data.equipment as Array<{ name: string; qty: number }> | undefined) ?? [];
    const spellsObj = (data.spells as { known?: Array<{ name: string; level: number; prepared?: boolean }>; slots?: Record<string, { max: number; used: number }> } | undefined) ?? {};
    const profRaw = data.proficiencies as
      | { armor?: string[]; weapons?: string[]; tools?: string[]; languages?: string[] }
      | undefined;
    const proficiencies = {
      armor: Array.isArray(profRaw?.armor) ? profRaw!.armor : [],
      weapons: Array.isArray(profRaw?.weapons) ? profRaw!.weapons : [],
      tools: Array.isArray(profRaw?.tools) ? profRaw!.tools : [],
      languages: Array.isArray(profRaw?.languages) ? profRaw!.languages : [],
    };
    const liveStatuses = (data.statusEffects as string[] | undefined) ?? [];
    const snapStatuses = (state.players?.find((p2) => p2.id === p.player_id)?.statusEffects ?? []) as string[];
    const xpRaw = data.xp;
    const xpNum = typeof xpRaw === "number" && Number.isFinite(xpRaw) ? Math.floor(xpRaw) : undefined;
    return {
      id: p.player_id,
      name: ch?.name ?? t(locale, "defaults.adventurer"),
      class: ch?.class ?? "",
      race: ch?.race ?? "",
      level: ch?.level ?? 1,
      ...(xpNum !== undefined ? { xp: xpNum } : {}),
      hp: { current: hp.current ?? 10, max: hp.max ?? 10, temp: hp.temp ?? 0 },
      ac: (data.ac as number) ?? 10,
      notableItems: [],
      statusEffects: liveStatuses.length ? liveStatuses : snapStatuses,
      equipment,
      spellsKnown: spellsObj.known,
      spellSlots: spellsObj.slots,
      proficiencies,
    };
  });

  const storyData = storyRow?.data_json
    ? (JSON.parse(storyRow.data_json) as { seed?: string; sourceFileName?: string | null })
    : {};
  const storyId = sessionRow.story_id;
  const adventureLoaded = Boolean(storyRow?.source_pdf) && hasAdventure(storyId);
  const adventureOutline = adventureLoaded ? getAdventureOutline(storyId) : null;

  const snap: SessionSnapshot = {
    storyTitle: storyRow?.title ?? (locale === "en" ? "Adventure" : "Aventura"),
    mode: body.mode,
    turn: sessionRow.turn,
    summary: state.summary ?? storyRow?.summary ?? undefined,
    players,
    recentLog: state.recentLog ?? [],
    tone: state.tone ?? 50,
    difficulty: normalizeDifficulty(state.difficulty),
    initiative: state.initiative,
    openingDone: state.openingDone,
    seed: storyData.seed,
    adventureOutline,
    adventureSourceName: storyData.sourceFileName ?? null,
    combat: state.combat === true,
    battleMap: state.battleMap ?? null,
    combatTracker: state.combatTracker ?? null,
    locale,
  };

  const ragBudget = getDmRagBudget();
  const ragCaps = {
    rulesChunkChars: ragBudget.rulesChunkChars,
    adventureChunkChars: ragBudget.adventureChunkChars,
  };

  const action: ChatReq["action"] = body.action ?? (body.text && body.text.trim() ? "player" : "continue");

  let retrievalQuery = "";
  let turnAction: TurnAction;
  if (action === "opening") {
    turnAction = { kind: "opening" };
    retrievalQuery = `inicio aventura ${snap.storyTitle} ${snap.seed ?? ""} ${players.map((p) => `${p.race} ${p.class}`).join(" ")}`;
  } else if (action === "continue") {
    /** kind=public: mensajes de jugador, tiradas persistidas (🎲), y narrativa del DM en modo automático. */
    const recent = db
      .prepare<
        [string],
        { role: string; content: string }
      >(
        `SELECT role, content FROM session_message WHERE session_id = ? AND kind = 'public' ORDER BY id DESC LIMIT 20`
      )
      .all(body.sessionId)
      .reverse();
    const signals = recent
      .filter((m) => m.role === "player")
      .map((m) => m.content.slice(0, 280));
    turnAction = { kind: "continue", recentSignals: signals };
    retrievalQuery = signals.join(" ") || snap.summary || snap.storyTitle;
  } else {
    turnAction = {
      kind: "player",
      playerName: body.playerName ?? t(locale, "errors.playerDefault"),
      text: body.text ?? "",
      sceneInfoRequest: body.sceneInfoRequest === true,
    };
    retrievalQuery = body.text ?? "";
  }

  const rulesCtx = await retrieveRules(retrievalQuery || snap.storyTitle, { k: ragBudget.rulesK });

  if (adventureLoaded) {
    try {
      const advChunks = await retrieveAdventure(storyId, retrievalQuery || snap.storyTitle, { k: ragBudget.adventureK });
      snap.adventureChunks = advChunks;
    } catch (err) {
      console.warn("retrieveAdventure:", (err as Error).message);
    }
  }

  const messages =
    body.mode === "auto"
      ? buildAutoDmPrompt(snap, rulesCtx, turnAction, ragCaps)
      : buildAssistantDmPrompt(snap, rulesCtx, body.text ?? "Continúa ayudando al DM.", ragCaps);

  if (action === "player" && body.text && body.text.trim()) {
    db.prepare(
      `INSERT INTO session_message(session_id, role, player_id, kind, content, created_at) VALUES(?, 'player', ?, ?, ?, ?)`
    ).run(
      body.sessionId,
      body.playerId ?? null,
      body.mode === "assistant" ? "dm-assistant" : "public",
      body.text,
      Date.now()
    );
    // La difusión del texto del jugador la hace ya `chat:send` en el cliente (socket);
    // repetir aquí duplica el mensaje en la crónica del DM y del grupo.
  }

  const encoder = new TextEncoder();
  let fullText = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const tok of chatStream(messages)) {
          fullText += tok;
          controller.enqueue(encoder.encode(tok));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n[error] ${llmErrorMessage(err, locale)}`));
      } finally {
        try {
          const parsed = parseDmResponse(fullText);
          const cleanNarrative = parsed.narrative.replace(/\[emocion:[^\]]+\]/gi, "").trim();
          const persistDmContent = body.mode === "assistant" ? fullText : cleanNarrative;
          db.prepare(
            `INSERT INTO session_message(session_id, role, kind, content, created_at) VALUES(?, 'dm', ?, ?, ?)`
          ).run(body.sessionId, body.mode === "assistant" ? "dm-assistant" : "public", persistDmContent, Date.now());
          db.prepare("UPDATE session SET turn = turn + 1, updated_at = ? WHERE id = ?").run(Date.now(), body.sessionId);
          const nextState: PersistedState = { ...state };
          if (action === "opening") nextState.openingDone = true;

          const actObj = parsed.actions as Record<string, unknown>;
          const summaryUpdate = typeof actObj.summary_update === "string" ? (actObj.summary_update as string) : undefined;
          if (summaryUpdate) {
            const cur = (nextState.summary ?? "").trim();
            nextState.summary = (cur ? cur + " · " : "") + summaryUpdate;
            if (nextState.summary.length > 1400) nextState.summary = nextState.summary.slice(-1400);
          }

          const prevLog = nextState.recentLog ?? [];
          const logEntry =
            action === "player"
              ? `T${sessionRow.turn + 1} · ${body.playerName ?? t(locale, "errors.playerDefault")}: ${(body.text ?? "").slice(0, 120)} → DM: ${(summaryUpdate ?? parsed.narrative.slice(0, 120)).trim()}`
              : `T${sessionRow.turn + 1} · DM: ${(summaryUpdate ?? parsed.narrative.slice(0, 120)).trim()}`;
          const extraLog: string[] = [];
          const rawDiceReq = actObj.dice_requests;
          if (Array.isArray(rawDiceReq) && rawDiceReq.length) {
            const bits = (rawDiceReq as Array<Record<string, unknown>>)
              .filter((r) => typeof r.expression === "string")
              .map((r) => {
                const pid = typeof r.player_id === "string" ? r.player_id : "?";
                const expr = r.expression as string;
                const lab = typeof r.label === "string" ? r.label : "";
                const id = typeof r.id === "string" ? r.id : "";
                return `${lab ? `${lab}: ` : ""}${expr} → ${pid}${id ? ` [${id}]` : ""}`;
              });
            if (bits.length) {
              extraLog.push(
                `T${sessionRow.turn + 1} · Pendiente tirada (resolver antes de avanzar narrativamente): ${bits.join(" · ")}`
              );
            }
          }
          const rawRevoke = actObj.dice_revoke;
          if (Array.isArray(rawRevoke) && rawRevoke.length) {
            const ids = (rawRevoke as unknown[]).filter((x): x is string => typeof x === "string");
            if (ids.length) {
              extraLog.push(`T${sessionRow.turn + 1} · Tiradas revocadas (ya no aplican): ${ids.join(", ")}`);
            }
          }
          nextState.recentLog = [...prevLog, logEntry, ...extraLog].slice(-12);

          if (actObj.map && typeof actObj.map === "object") {
            const hint = (actObj.map as { hint?: string }).hint;
            if (hint) nextState.sceneTags = [hint];
          }
          if (Array.isArray(actObj.initiative)) {
            nextState.initiative = (actObj.initiative as Array<{ player_id?: string; value?: number }>)
              .filter((i) => i && typeof i.player_id === "string" && typeof i.value === "number")
              .map((i) => ({ player_id: i.player_id as string, value: i.value as number }));
          }

          let nextCombat = nextState.combat === true;
          if (typeof actObj.combat === "boolean") nextCombat = actObj.combat;
          if (actObj.combat_end === true) nextCombat = false;
          nextState.combat = nextCombat;

          const rawBattle = actObj.battle_map;
          if (rawBattle && typeof rawBattle === "object" && !Array.isArray(rawBattle)) {
            const bm = rawBattle as Record<string, unknown>;
            const gridRaw = (bm.grid as Record<string, unknown> | undefined) ?? {};
            const cols = Math.max(6, Math.min(40, Number(gridRaw.cols) || 20));
            const rows = Math.max(6, Math.min(40, Number(gridRaw.rows) || 12));
            const cellFeet = Number(gridRaw.cellFeet) || 5;
            const parts = Array.isArray(bm.participants) ? (bm.participants as Array<Record<string, unknown>>) : [];
            const participants: BattleParticipant[] = parts
              .map((p) => {
                const kindRaw = typeof p.kind === "string" ? (p.kind as string).toLowerCase() : "";
                const kind: BattleParticipant["kind"] =
                  kindRaw === "enemy" || kindRaw === "ally" || kindRaw === "neutral" || kindRaw === "player"
                    ? (kindRaw as BattleParticipant["kind"])
                    : "neutral";
                const hpRaw = p.hp as Record<string, unknown> | undefined;
                const hp =
                  hpRaw && typeof hpRaw === "object"
                    ? {
                        current: Math.max(0, Number(hpRaw.current) || 0),
                        max: Math.max(1, Number(hpRaw.max) || 1),
                      }
                    : undefined;
                return {
                  id: typeof p.id === "string" ? (p.id as string) : "",
                  name: typeof p.name === "string" ? (p.name as string) : "?",
                  kind,
                  x: Math.max(0, Math.min(cols - 1, Math.round(Number(p.x) || 0))),
                  y: Math.max(0, Math.min(rows - 1, Math.round(Number(p.y) || 0))),
                  hp,
                  status: Array.isArray(p.status) ? (p.status as unknown[]).filter((s): s is string => typeof s === "string") : undefined,
                };
              })
              .filter((p) => p.id);
            const obsRaw = Array.isArray(bm.obstacles) ? (bm.obstacles as Array<Record<string, unknown>>) : [];
            const obstacles = obsRaw
              .map((o) => ({
                x: Math.max(0, Math.round(Number(o.x) || 0)),
                y: Math.max(0, Math.round(Number(o.y) || 0)),
                w: Math.max(1, Math.round(Number(o.w) || 1)),
                h: Math.max(1, Math.round(Number(o.h) || 1)),
                kind: typeof o.kind === "string" ? (o.kind as string) : "cover",
              }))
              .filter((o) => o.x < cols && o.y < rows);
            nextState.battleMap = {
              terrain: typeof bm.terrain === "string" ? (bm.terrain as string) : nextState.sceneTags?.[0],
              grid: { cols, rows, cellFeet },
              participants,
              obstacles,
            };
          }

          if (!nextCombat) {
            nextState.battleMap = null;
            nextState.initiative = [];
            delete nextState.combatTracker;
          } else {
            const ct = coerceCombatTracker(actObj.combat_tracker);
            if (ct) nextState.combatTracker = ct;
          }

          db.prepare("UPDATE session SET state_json = ?, updated_at = ? WHERE id = ?").run(
            JSON.stringify(nextState),
            Date.now(),
            body.sessionId
          );

          let levelUpsFromActions: { characterName: string; oldLevel: number; newLevel: number; totalXp: number }[] = [];
          if (body.mode === "auto") {
            try {
              levelUpsFromActions = applyDmActions(body.sessionId, actObj).levelUps;
            } catch (err) {
              console.warn("applyDmActions:", (err as Error).message);
            }
          }

          try {
            const io = getIo();
            if (io) {
              if (body.mode === "assistant") {
                if (fullText.trim()) {
                  io.to(`session:${body.sessionId}:dm`).emit("chat:message", {
                    sessionId: body.sessionId,
                    role: "dm",
                    kind: "dm-assistant",
                    text: fullText,
                    originClientId: body.clientId,
                    id: `dm:${Date.now().toString(36)}`,
                  });
                }
              } else if (cleanNarrative) {
                io.to(`session:${body.sessionId}`).emit("chat:message", {
                  sessionId: body.sessionId,
                  role: "dm",
                  kind: "public",
                  text: cleanNarrative,
                  originClientId: body.clientId,
                  id: `dm:${Date.now().toString(36)}`,
                });
              }
              for (const up of levelUpsFromActions) {
                const sysText = t(locale, "dm.levelUp.system", {
                  name: up.characterName.trim() || t(locale, "defaults.adventurer"),
                  from: up.oldLevel,
                  to: up.newLevel,
                  xp: up.totalXp,
                });
                const sysId = `sys:xp:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
                db.prepare(
                  `INSERT INTO session_message(session_id, role, player_id, kind, content, created_at) VALUES(?, 'system', NULL, 'public', ?, ?)`
                ).run(body.sessionId, sysText, Date.now());
                io.to(`session:${body.sessionId}`).emit("chat:message", {
                  sessionId: body.sessionId,
                  role: "system",
                  kind: "public",
                  text: sysText,
                  id: sysId,
                });
              }
              io.to(`session:${body.sessionId}`).emit("scene:update", {
                sessionId: body.sessionId,
                combat: nextState.combat === true,
                battleMap: nextState.battleMap ?? null,
                sceneTags: nextState.sceneTags ?? [],
              });
            }
          } catch {}
        } catch {}

        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
