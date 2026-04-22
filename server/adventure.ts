import { readFileSync } from "node:fs";
import { getDb } from "@/lib/db";
import { embed } from "./ollama";
import { chatComplete } from "./providers/chat";
import { serverT } from "@/lib/i18n/server";

export type AdventureChunk = {
  id: number;
  story_id: string;
  section: string;
  subsection: string | null;
  page: number;
  text: string;
  score: number;
  source: "vec" | "fts";
};

function floatArrayToBlob(vec: number[]): Buffer {
  const buf = Buffer.alloc(vec.length * 4);
  for (let i = 0; i < vec.length; i++) buf.writeFloatLE(vec[i], i * 4);
  return buf;
}

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export async function extractAdventurePages(
  pdfPath: string
): Promise<{ page: number; text: string }[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(pdfPath));
  const loadingTask = getDocument({
    data,
    disableFontFace: true,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  const pages: { page: number; text: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: unknown) => {
        const item = it as { str?: string; hasEOL?: boolean };
        return (item.str ?? "") + (item.hasEOL ? "\n" : " ");
      })
      .join("");
    pages.push({ page: i, text });
  }
  return pages;
}

const MAX_CHUNK_TOKENS = 650;
const OVERLAP_CHARS = 450;

export function chunkAdventurePages(
  pages: { page: number; text: string }[]
): { section: string; subsection: string | null; page: number; text: string; tokens: number }[] {
  const chunks: { section: string; subsection: string | null; page: number; text: string; tokens: number }[] = [];
  let buffer = "";
  let bufferPage = pages[0]?.page ?? 1;
  let bufferTokens = 0;
  let currentSubsection: string | null = null;

  const flush = () => {
    const text = buffer.trim();
    if (text.length < 60) {
      buffer = "";
      bufferTokens = 0;
      return;
    }
    chunks.push({
      section: "aventura",
      subsection: currentSubsection,
      page: bufferPage,
      text,
      tokens: bufferTokens,
    });
    const tail = text.length > OVERLAP_CHARS ? text.slice(-OVERLAP_CHARS) : "";
    buffer = tail;
    bufferTokens = approxTokens(tail);
  };

  for (const page of pages) {
    const rawLines = page.text.split(/\r?\n/);
    for (const raw of rawLines) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;

      const isHeading =
        line.length > 2 &&
        line.length < 80 &&
        /^[0-9A-ZÁÉÍÓÚÑ]/.test(line) &&
        !line.endsWith(".") &&
        !line.endsWith(",") &&
        (line === line.toUpperCase() || /^(cap[ií]tulo|chapter|escena|scene|act[oa]|parte|part)\b/i.test(line));

      if (isHeading) {
        if (bufferTokens > 120) flush();
        currentSubsection = line.slice(0, 120);
        if (!buffer) bufferPage = page.page;
      }

      const t = approxTokens(line);
      if (bufferTokens + t > MAX_CHUNK_TOKENS) {
        flush();
        bufferPage = page.page;
      }
      buffer += (buffer ? " " : "") + line;
      bufferTokens += t;
    }
    if (bufferTokens > MAX_CHUNK_TOKENS * 0.9) {
      flush();
      bufferPage = page.page + 1;
    }
  }
  flush();
  return chunks;
}

export type IngestProgress = (status: {
  done: number;
  total: number;
  phase: "extracting" | "embedding" | "summarizing" | "done" | "error";
  error?: string;
}) => void;

export async function ingestAdventure(
  storyId: string,
  pdfPath: string,
  onProgress?: IngestProgress
): Promise<{ chunks: number; outline: string | null }> {
  const db = getDb();

  db.prepare("DELETE FROM adventure_chunk WHERE story_id = ?").run(storyId);
  try {
    db.exec(
      `DELETE FROM adventure_vec WHERE rowid IN (SELECT rowid FROM adventure_fts WHERE story_id = '${storyId.replace(/'/g, "''")}')`
    );
  } catch {}
  try {
    db.prepare("DELETE FROM adventure_fts WHERE story_id = ?").run(storyId);
  } catch {}

  onProgress?.({ done: 0, total: 1, phase: "extracting" });
  const pages = await extractAdventurePages(pdfPath);
  const chunks = chunkAdventurePages(pages);
  onProgress?.({ done: 0, total: chunks.length, phase: "embedding" });

  const insChunk = db.prepare(
    `INSERT INTO adventure_chunk(story_id, section, subsection, page, text, tokens) VALUES(?, ?, ?, ?, ?, ?)`
  );
  const insFts = db.prepare(
    `INSERT INTO adventure_fts(rowid, story_id, section, subsection, text) VALUES(?, ?, ?, ?, ?)`
  );
  let insVec: { run: (rowid: number, blob: Buffer) => unknown } | null = null;
  try {
    const stmt = db.prepare(`INSERT INTO adventure_vec(rowid, embedding) VALUES(?, ?)`);
    insVec = { run: (rowid: number, blob: Buffer) => stmt.run(BigInt(rowid), blob) };
  } catch {
    insVec = null;
  }

  const BATCH = 8;
  let done = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const texts = slice.map((c) => `${c.subsection ? c.subsection + "\n" : ""}${c.text}`);
    let embeddings: number[][] = [];
    if (insVec) {
      try {
        embeddings = await embed(texts);
      } catch {
        embeddings = [];
      }
    }

    const tx = db.transaction(() => {
      slice.forEach((c, idx) => {
        const info = insChunk.run(storyId, c.section, c.subsection, c.page, c.text, c.tokens);
        const rowid = Number(info.lastInsertRowid);
        insFts.run(rowid, storyId, c.section, c.subsection ?? "", c.text);
        if (insVec && embeddings[idx] && embeddings[idx].length > 0) {
          try {
            insVec.run(rowid, floatArrayToBlob(embeddings[idx]));
          } catch (err) {
            if (!(globalThis as { __advVecErrLogged?: boolean }).__advVecErrLogged) {
              (globalThis as { __advVecErrLogged?: boolean }).__advVecErrLogged = true;
              console.warn("adventure vec insert warning:", (err as Error).message);
            }
          }
        }
      });
    });
    tx();
    done += slice.length;
    onProgress?.({ done, total: chunks.length, phase: "embedding" });
  }

  onProgress?.({ done: chunks.length, total: chunks.length, phase: "summarizing" });
  const outline = await summarizeAdventure(storyId);

  onProgress?.({ done: chunks.length, total: chunks.length, phase: "done" });
  return { chunks: chunks.length, outline };
}

export function hasAdventure(storyId: string): boolean {
  const db = getDb();
  const row = db
    .prepare<string, { c: number }>("SELECT COUNT(*) AS c FROM adventure_chunk WHERE story_id = ?")
    .get(storyId);
  return (row?.c ?? 0) > 0;
}

export function adventureStats(storyId: string): { total: number; vec: number } {
  const db = getDb();
  const total = (db
    .prepare<string, { c: number }>("SELECT COUNT(*) AS c FROM adventure_chunk WHERE story_id = ?")
    .get(storyId)?.c) ?? 0;
  let vec = 0;
  try {
    const row = db
      .prepare<string, { c: number }>(
        `SELECT COUNT(*) AS c FROM adventure_vec WHERE rowid IN (SELECT id FROM adventure_chunk WHERE story_id = ?)`
      )
      .get(storyId);
    vec = row?.c ?? 0;
  } catch {}
  return { total, vec };
}

export async function retrieveAdventure(
  storyId: string,
  query: string,
  opts: { k?: number } = {}
): Promise<AdventureChunk[]> {
  const db = getDb();
  const k = opts.k ?? 6;

  let vec: AdventureChunk[] = [];
  try {
    const [emb] = await embed([query]);
    if (emb && emb.length > 0) {
      const rows = db
        .prepare(
          `SELECT ac.id, ac.story_id, ac.section, ac.subsection, ac.page, ac.text, v.distance AS score
           FROM adventure_vec v
           JOIN adventure_chunk ac ON ac.id = v.rowid
           WHERE v.embedding MATCH ? AND k = ? AND ac.story_id = ?
           ORDER BY v.distance ASC`
        )
        .all(floatArrayToBlob(emb), k * 2, storyId) as Array<Omit<AdventureChunk, "source">>;
      vec = rows.slice(0, k).map((r) => ({ ...r, source: "vec" }));
    }
  } catch {
    // fallback a fts
  }

  let fts: AdventureChunk[] = [];
  try {
    const cleanQuery = query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
    if (cleanQuery.length > 0) {
      const rows = db
        .prepare(
          `SELECT ac.id, ac.story_id, ac.section, ac.subsection, ac.page, ac.text, bm25(adventure_fts) AS score
           FROM adventure_fts
           JOIN adventure_chunk ac ON ac.id = adventure_fts.rowid
           WHERE adventure_fts MATCH ? AND ac.story_id = ?
           ORDER BY bm25(adventure_fts) ASC
           LIMIT ?`
        )
        .all(cleanQuery, storyId, k) as Array<Omit<AdventureChunk, "source">>;
      fts = rows.map((r) => ({ ...r, source: "fts" }));
    }
  } catch {}

  const seen = new Set<number>();
  const merged: AdventureChunk[] = [];
  for (const list of [vec, fts]) {
    for (const c of list) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
      if (merged.length >= k) break;
    }
    if (merged.length >= k) break;
  }
  return merged;
}

export function getAdventureHeadSample(storyId: string, maxChars = 9000): string {
  const db = getDb();
  const rows = db
    .prepare<[string, number], { text: string }>(
      `SELECT text FROM adventure_chunk WHERE story_id = ? ORDER BY id ASC LIMIT ?`
    )
    .all(storyId, 60);
  let acc = "";
  for (const r of rows) {
    if (acc.length + r.text.length + 2 > maxChars) break;
    acc += (acc ? "\n\n" : "") + r.text;
  }
  return acc;
}

export async function summarizeAdventure(storyId: string): Promise<string | null> {
  const sample = getAdventureHeadSample(storyId);
  if (!sample) return null;

  const messages = [
    { role: "system" as const, content: serverT("adventure.summarize.system") },
    { role: "user" as const, content: serverT("adventure.summarize.user", { sample }) },
  ];

  try {
    const outline = await chatComplete(messages, { temperature: 0.3, maxTokens: 900 });
    const clean = outline.trim();
    if (!clean) return null;

    const db = getDb();
    const storyRow = db
      .prepare<string, { data_json: string }>("SELECT data_json FROM story WHERE id = ?")
      .get(storyId);
    const data = storyRow ? (JSON.parse(storyRow.data_json) as Record<string, unknown>) : {};
    data.adventureOutline = clean;
    db.prepare("UPDATE story SET data_json = ?, summary = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(data),
      clean.slice(0, 1200),
      Date.now(),
      storyId
    );
    return clean;
  } catch (err) {
    console.warn("summarizeAdventure:", (err as Error).message);
    return null;
  }
}

export function getAdventureOutline(storyId: string): string | null {
  const db = getDb();
  const row = db
    .prepare<string, { data_json: string }>("SELECT data_json FROM story WHERE id = ?")
    .get(storyId);
  if (!row) return null;
  try {
    const data = JSON.parse(row.data_json) as { adventureOutline?: string };
    return data.adventureOutline ?? null;
  } catch {
    return null;
  }
}
