import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "@/lib/db";
import { ingestAdventure } from "@/server/adventure";

export const runtime = "nodejs";

type CreateStory = {
  title: string;
  mode: "auto" | "assistant";
  seed?: string;
  source_pdf?: string;
  playerCharacterIds: string[];
};

const ADVENTURES_DIR = join(process.cwd(), "data", "adventures");

type IngestState = {
  status: "pending" | "running" | "done" | "error";
  phase?: "extracting" | "embedding" | "summarizing" | "done" | "error";
  done: number;
  total: number;
  error?: string;
  sourcePdf?: string;
  fileName?: string;
};

function writeIngestState(sessionId: string, patch: Partial<IngestState>) {
  const db = getDb();
  const row = db
    .prepare<string, { state_json: string }>("SELECT state_json FROM session WHERE id = ?")
    .get(sessionId);
  if (!row) return;
  let state: Record<string, unknown> = {};
  try {
    state = JSON.parse(row.state_json) as Record<string, unknown>;
  } catch {}
  const cur = (state.adventureIngest as IngestState | undefined) ?? {
    status: "pending",
    done: 0,
    total: 0,
  };
  state.adventureIngest = { ...cur, ...patch };
  db.prepare("UPDATE session SET state_json = ?, updated_at = ? WHERE id = ?").run(
    JSON.stringify(state),
    Date.now(),
    sessionId
  );
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let payload: CreateStory;
  let pdfBuffer: Buffer | null = null;
  let pdfFileName: string | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    payload = {
      title: String(form.get("title") ?? "").trim(),
      mode: (form.get("mode") === "assistant" ? "assistant" : "auto") as "auto" | "assistant",
      seed: typeof form.get("seed") === "string" ? (form.get("seed") as string) : undefined,
      playerCharacterIds: (() => {
        const raw = form.get("playerCharacterIds");
        if (typeof raw !== "string") return [];
        try {
          const parsed = JSON.parse(raw) as unknown;
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
        } catch {
          return [];
        }
      })(),
    };
    const file = form.get("adventurePdf");
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const f = file as File;
      const ab = await f.arrayBuffer();
      pdfBuffer = Buffer.from(ab);
      pdfFileName = f.name || "aventura.pdf";
    }
  } else {
    payload = (await req.json()) as CreateStory;
  }

  if (!payload.title || !Array.isArray(payload.playerCharacterIds) || payload.playerCharacterIds.length === 0) {
    return NextResponse.json({ error: "Título y personajes son obligatorios." }, { status: 400 });
  }

  const db = getDb();
  const now = Date.now();
  const storyId = nanoid(12);
  const sessionId = nanoid(12);

  let sourcePdfPath: string | null = null;
  if (pdfBuffer) {
    mkdirSync(ADVENTURES_DIR, { recursive: true });
    sourcePdfPath = join(ADVENTURES_DIR, `${storyId}.pdf`);
    writeFileSync(sourcePdfPath, pdfBuffer);
  }

  db.prepare(
    `INSERT INTO story(id, title, mode, source_pdf, summary, data_json, created_at, updated_at)
     VALUES(?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    storyId,
    payload.title,
    payload.mode,
    sourcePdfPath ?? payload.source_pdf ?? null,
    payload.seed ?? null,
    JSON.stringify({
      seed: payload.seed ?? null,
      playerCharacterIds: payload.playerCharacterIds,
      sourceFileName: pdfFileName,
    }),
    now,
    now
  );

  const initialState: Record<string, unknown> = {
    players: [],
    recentLog: [],
    summary: payload.seed ?? "",
  };
  if (sourcePdfPath) {
    initialState.adventureIngest = {
      status: "pending",
      phase: "extracting",
      done: 0,
      total: 0,
      sourcePdf: sourcePdfPath,
      fileName: pdfFileName ?? undefined,
    } satisfies IngestState;
  }

  db.prepare(
    `INSERT INTO session(id, story_id, state_json, turn, created_at, updated_at) VALUES(?, ?, ?, 0, ?, ?)`
  ).run(sessionId, storyId, JSON.stringify(initialState), now, now);

  const playerStmt = db.prepare(
    `INSERT INTO session_player(session_id, player_id, character_id, token, connected) VALUES(?, ?, ?, ?, 0)`
  );
  for (const chId of payload.playerCharacterIds) {
    playerStmt.run(sessionId, nanoid(8), chId, nanoid(10));
  }

  if (sourcePdfPath) {
    writeIngestState(sessionId, { status: "running", phase: "extracting" });
    const pdfPath = sourcePdfPath;
    void (async () => {
      try {
        await ingestAdventure(storyId, pdfPath, (progress) => {
          writeIngestState(sessionId, {
            status: progress.phase === "done" ? "done" : progress.phase === "error" ? "error" : "running",
            phase: progress.phase,
            done: progress.done,
            total: progress.total,
          });
        });
        writeIngestState(sessionId, {
          status: "done",
          phase: "done",
        });
      } catch (err) {
        writeIngestState(sessionId, {
          status: "error",
          phase: "error",
          error: (err as Error).message.slice(0, 300),
        });
      }
    })();
  }

  return NextResponse.json({ storyId, sessionId, ingesting: Boolean(sourcePdfPath) });
}
