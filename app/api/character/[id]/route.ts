import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getDb()
    .prepare<string, { id: string; name: string; level: number; class: string | null; race: string | null; background: string | null; portrait: string | null; data_json: string }>(
      "SELECT id, name, level, class, race, background, portrait, data_json FROM character WHERE id = ?"
    )
    .get(id);
  if (!row) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });
  return NextResponse.json({ ...row, data: JSON.parse(row.data_json) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const db = getDb();
  const row = db.prepare<string, { data_json: string }>("SELECT data_json FROM character WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: serverT("errors.notFound") }, { status: 404 });
  const next = { ...JSON.parse(row.data_json), ...body };
  db.prepare(`UPDATE character SET data_json = ?, updated_at = ? WHERE id = ?`).run(JSON.stringify(next), Date.now(), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  getDb().prepare("DELETE FROM character WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
