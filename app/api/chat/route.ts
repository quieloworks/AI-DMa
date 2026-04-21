import { NextRequest } from "next/server";
import { chatStream } from "@/server/providers/chat";
import { getDb } from "@/lib/db";
import {
  buildAutoDmPrompt,
  buildAssistantDmPrompt,
  parseDmResponse,
  normalizeDifficulty,
  type Difficulty,
  type SessionSnapshot,
  type TurnAction,
} from "@/server/dm/prompts";
import { retrieveRules } from "@/server/rag";
import { applyDmActions } from "@/server/dm/apply-actions";
import { getIo } from "@/server/io-bus";

export const runtime = "nodejs";

type ChatReq = {
  sessionId: string;
  mode: "auto" | "assistant";
  action?: "player" | "continue" | "opening";
  playerId?: string;
  playerName?: string;
  text?: string;
  tone?: number;
  difficulty?: Difficulty | string;
  clientId?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ChatReq;
  const db = getDb();

  const sessionRow = db
    .prepare<string, { id: string; story_id: string; state_json: string; turn: number }>(
      "SELECT id, story_id, state_json, turn FROM session WHERE id = ?"
    )
    .get(body.sessionId);
  if (!sessionRow) return new Response("Sesión no existe", { status: 404 });

  const storyRow = db
    .prepare<string, { title: string; summary: string | null; data_json: string }>(
      "SELECT title, summary, data_json FROM story WHERE id = ?"
    )
    .get(sessionRow.story_id);

  type PersistedState = {
    players?: Array<{ id: string; statusEffects?: string[] }>;
    summary?: string;
    recentLog?: string[];
    sceneTags?: string[];
    sceneImage?: string;
    tone?: number;
    difficulty?: Difficulty;
    openingDone?: boolean;
    initiative?: Array<{ player_id: string; value: number }>;
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
    const liveStatuses = (data.statusEffects as string[] | undefined) ?? [];
    const snapStatuses = (state.players?.find((p2) => p2.id === p.player_id)?.statusEffects ?? []) as string[];
    return {
      id: p.player_id,
      name: ch?.name ?? "Aventurero",
      class: ch?.class ?? "",
      race: ch?.race ?? "",
      level: ch?.level ?? 1,
      hp: { current: hp.current ?? 10, max: hp.max ?? 10, temp: hp.temp ?? 0 },
      ac: (data.ac as number) ?? 10,
      notableItems: [],
      statusEffects: liveStatuses.length ? liveStatuses : snapStatuses,
      equipment,
      spellsKnown: spellsObj.known,
      spellSlots: spellsObj.slots,
    };
  });

  const storyData = storyRow?.data_json ? (JSON.parse(storyRow.data_json) as { seed?: string }) : {};

  const snap: SessionSnapshot = {
    storyTitle: storyRow?.title ?? "Aventura",
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
  };

  const action: ChatReq["action"] = body.action ?? (body.text && body.text.trim() ? "player" : "continue");

  let retrievalQuery = "";
  let turnAction: TurnAction;
  if (action === "opening") {
    turnAction = { kind: "opening" };
    retrievalQuery = `inicio aventura ${snap.storyTitle} ${snap.seed ?? ""} ${players.map((p) => `${p.race} ${p.class}`).join(" ")}`;
  } else if (action === "continue") {
    const recent = db
      .prepare<
        [string, string],
        { role: string; content: string }
      >(
        `SELECT role, content FROM session_message WHERE session_id = ? AND kind = ? ORDER BY id DESC LIMIT 8`
      )
      .all(body.sessionId, body.mode === "assistant" ? "dm-assistant" : "public")
      .reverse();
    const signals = recent
      .filter((m) => m.role === "player")
      .map((m) => m.content.slice(0, 200));
    turnAction = { kind: "continue", recentSignals: signals };
    retrievalQuery = signals.join(" ") || snap.summary || snap.storyTitle;
  } else {
    turnAction = { kind: "player", playerName: body.playerName ?? "Jugador", text: body.text ?? "" };
    retrievalQuery = body.text ?? "";
  }

  const rulesCtx = await retrieveRules(retrievalQuery || snap.storyTitle, { k: 5 });

  const messages =
    body.mode === "auto"
      ? buildAutoDmPrompt(snap, rulesCtx, turnAction)
      : buildAssistantDmPrompt(snap, rulesCtx, body.text ?? "Continúa ayudando al DM.");

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
    try {
      const io = getIo();
      if (io) {
        io.to(`session:${body.sessionId}`).emit("chat:message", {
          sessionId: body.sessionId,
          role: "player",
          playerId: body.playerId,
          kind: body.mode === "assistant" ? "dm-assistant" : "public",
          text: body.text,
          originClientId: body.clientId,
        });
      }
    } catch {}
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
        controller.enqueue(encoder.encode(`\n[error] ${(err as Error).message}`));
      } finally {
        db.prepare(
          `INSERT INTO session_message(session_id, role, kind, content, created_at) VALUES(?, 'dm', ?, ?, ?)`
        ).run(body.sessionId, body.mode === "assistant" ? "dm-assistant" : "public", fullText, Date.now());
        db.prepare("UPDATE session SET turn = turn + 1, updated_at = ? WHERE id = ?").run(Date.now(), body.sessionId);

        try {
          const parsed = parseDmResponse(fullText);
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
              ? `T${sessionRow.turn + 1} · ${body.playerName ?? "Jugador"}: ${(body.text ?? "").slice(0, 120)} → DM: ${(summaryUpdate ?? parsed.narrative.slice(0, 120)).trim()}`
              : `T${sessionRow.turn + 1} · DM: ${(summaryUpdate ?? parsed.narrative.slice(0, 120)).trim()}`;
          nextState.recentLog = [...prevLog, logEntry].slice(-12);

          if (actObj.map && typeof actObj.map === "object") {
            const hint = (actObj.map as { hint?: string }).hint;
            if (hint) nextState.sceneTags = [hint];
          }
          if (Array.isArray(actObj.initiative)) {
            nextState.initiative = (actObj.initiative as Array<{ player_id?: string; value?: number }>)
              .filter((i) => i && typeof i.player_id === "string" && typeof i.value === "number")
              .map((i) => ({ player_id: i.player_id as string, value: i.value as number }));
          }

          db.prepare("UPDATE session SET state_json = ?, updated_at = ? WHERE id = ?").run(
            JSON.stringify(nextState),
            Date.now(),
            body.sessionId
          );

          if (body.mode === "auto") {
            try {
              applyDmActions(body.sessionId, actObj);
            } catch (err) {
              console.warn("applyDmActions:", (err as Error).message);
            }
          }

          try {
            const io = getIo();
            if (io) {
              const clean = parsed.narrative.replace(/\[emocion:[^\]]+\]/gi, "").trim();
              if (clean) {
                io.to(`session:${body.sessionId}`).emit("chat:message", {
                  sessionId: body.sessionId,
                  role: "dm",
                  kind: body.mode === "assistant" ? "dm-assistant" : "public",
                  text: clean,
                  originClientId: body.clientId,
                  id: `dm:${Date.now().toString(36)}`,
                });
              }
            }
          } catch {}
        } catch {}

        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
