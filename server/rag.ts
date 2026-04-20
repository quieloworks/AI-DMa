import { getDb } from "@/lib/db";
import { embed } from "./ollama";

export type RetrievedChunk = {
  id: number;
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

export async function retrieveRules(query: string, opts: { section?: string; k?: number } = {}): Promise<RetrievedChunk[]> {
  const db = getDb();
  const k = opts.k ?? 6;

  let vec: RetrievedChunk[] = [];
  try {
    const [emb] = await embed([query]);
    if (emb && emb.length > 0) {
      const sql = `
        SELECT hc.id, hc.section, hc.subsection, hc.page, hc.text, v.distance AS score
        FROM handbook_vec v
        JOIN handbook_chunk hc ON hc.id = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
        ${opts.section ? "AND hc.section = ?" : ""}
        ORDER BY v.distance ASC
      `;
      const params: unknown[] = [floatArrayToBlob(emb), k];
      if (opts.section) params.push(opts.section);
      const rows = db.prepare(sql).all(...params) as Array<Omit<RetrievedChunk, "source">>;
      vec = rows.map((r) => ({ ...r, source: "vec" }));
    }
  } catch {
    // sin vec, fallback a FTS
  }

  let fts: RetrievedChunk[] = [];
  try {
    const clauses: string[] = [];
    const params: unknown[] = [];
    clauses.push("handbook_fts MATCH ?");
    params.push(query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim());
    if (opts.section) {
      clauses.push("hc.section = ?");
      params.push(opts.section);
    }
    params.push(k);
    const rows = db
      .prepare(
        `SELECT hc.id, hc.section, hc.subsection, hc.page, hc.text, bm25(handbook_fts) AS score
         FROM handbook_fts
         JOIN handbook_chunk hc ON hc.id = handbook_fts.rowid
         WHERE ${clauses.join(" AND ")}
         ORDER BY bm25(handbook_fts) ASC
         LIMIT ?`
      )
      .all(...params) as Array<Omit<RetrievedChunk, "source">>;
    fts = rows.map((r) => ({ ...r, source: "fts" }));
  } catch {
    // fts puede no existir si aún no se ingestó
  }

  const seen = new Set<number>();
  const merged: RetrievedChunk[] = [];
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

export function handbookStats() {
  const db = getDb();
  const total = (db.prepare("SELECT COUNT(*) as c FROM handbook_chunk").get() as { c: number }).c;
  let vecCount = 0;
  try {
    vecCount = (db.prepare("SELECT COUNT(*) as c FROM handbook_vec").get() as { c: number }).c;
  } catch {}
  const bySection = db.prepare("SELECT section, COUNT(*) as c FROM handbook_chunk GROUP BY section ORDER BY c DESC").all() as Array<{ section: string; c: number }>;
  return { total, vecCount, bySection };
}

export async function insertChunksWithEmbeddings(chunks: { section: string; subsection: string | null; page: number; text: string; tokens: number }[], onProgress?: (done: number, total: number) => void) {
  const db = getDb();
  const insChunk = db.prepare(`INSERT INTO handbook_chunk(section, subsection, page, text, tokens) VALUES(?, ?, ?, ?, ?)`);
  const insFts = db.prepare(`INSERT INTO handbook_fts(rowid, section, subsection, text) VALUES(?, ?, ?, ?)`);
  let insVec: { run: (rowid: number, blob: Buffer) => unknown } | null = null;
  try {
    const stmt = db.prepare(`INSERT INTO handbook_vec(rowid, embedding) VALUES(?, ?)`);
    insVec = { run: (rowid: number, blob: Buffer) => stmt.run(BigInt(rowid), blob) };
  } catch {
    insVec = null;
  }

  const BATCH = 16;
  let done = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const slice = chunks.slice(i, i + BATCH);
    const texts = slice.map((c) => `${c.section}${c.subsection ? " / " + c.subsection : ""}\n${c.text}`);
    let embeddings: number[][] = [];
    if (insVec) embeddings = await embed(texts);

    const tx = db.transaction(() => {
      slice.forEach((c, idx) => {
        const info = insChunk.run(c.section, c.subsection, c.page, c.text, c.tokens);
        const rowid = Number(info.lastInsertRowid);
        insFts.run(rowid, c.section, c.subsection ?? "", c.text);
        if (insVec && embeddings[idx]) {
          try {
            insVec.run(rowid, floatArrayToBlob(embeddings[idx]));
          } catch (err) {
            if (!(globalThis as { __vecErrLogged?: boolean }).__vecErrLogged) {
              (globalThis as { __vecErrLogged?: boolean }).__vecErrLogged = true;
              console.warn("vec insert warning:", (err as Error).message);
            }
          }
        }
      });
    });
    tx();
    done += slice.length;
    onProgress?.(done, chunks.length);
  }
}

export function clearHandbook() {
  const db = getDb();
  db.exec("DELETE FROM handbook_fts; DELETE FROM handbook_chunk;");
  try {
    db.exec("DELETE FROM handbook_vec;");
  } catch {}
}
