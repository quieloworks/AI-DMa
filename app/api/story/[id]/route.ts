import { NextRequest, NextResponse } from "next/server";
import { getDb, getMeta, setMeta } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db
    .prepare<string, { id: string; title: string; mode: string; summary: string | null; data_json: string; created_at: number; updated_at: number }>(
      "SELECT id, title, mode, summary, data_json, created_at, updated_at FROM story WHERE id = ?"
    )
    .get(id);
  if (!row) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });
  const sessions = db
    .prepare<string, { id: string; turn: number; updated_at: number }>(
      "SELECT id, turn, updated_at FROM session WHERE story_id = ? ORDER BY updated_at DESC"
    )
    .all(id);
  return NextResponse.json({ ...row, data: JSON.parse(row.data_json), sessions });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { title?: string; summary?: string; mode?: "auto" | "assistant"; data?: Record<string, unknown> };
  const db = getDb();
  const row = db.prepare<string, { data_json: string }>("SELECT data_json FROM story WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });

  const updates: string[] = [];
  const params: Array<string | number | null> = [];
  if (typeof body.title === "string") {
    updates.push("title = ?");
    params.push(body.title);
  }
  if (typeof body.summary === "string") {
    updates.push("summary = ?");
    params.push(body.summary);
  }
  if (body.mode === "auto" || body.mode === "assistant") {
    updates.push("mode = ?");
    params.push(body.mode);
  }
  if (body.data) {
    const merged = { ...JSON.parse(row.data_json), ...body.data };
    updates.push("data_json = ?");
    params.push(JSON.stringify(merged));
  }
  updates.push("updated_at = ?");
  params.push(Date.now());
  params.push(id);

  db.prepare(`UPDATE story SET ${updates.join(", ")} WHERE id = ?`).run(...params);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  db.prepare("DELETE FROM session_message WHERE session_id IN (SELECT id FROM session WHERE story_id = ?)").run(id);
  db.prepare("DELETE FROM session_player WHERE session_id IN (SELECT id FROM session WHERE story_id = ?)").run(id);
  db.prepare("DELETE FROM session WHERE story_id = ?").run(id);
  db.prepare("DELETE FROM story WHERE id = ?").run(id);
  const active = getMeta("active_session_id");
  if (active) {
    const stillExists = db.prepare<string, { id: string }>("SELECT id FROM session WHERE id = ?").get(active);
    if (!stillExists) setMeta("active_session_id", "");
  }
  return NextResponse.json({ ok: true });
}
