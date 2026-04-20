import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name: string; level?: number; class?: string; race?: string; background?: string; portrait?: string } & Record<string, unknown>;
  const id = nanoid(12);
  const now = Date.now();
  const db = getDb();
  db.prepare(
    `INSERT INTO character(id, name, owner, level, class, race, background, portrait, data_json, created_at, updated_at)
     VALUES(?, ?, 'local', ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    body.name,
    body.level ?? 1,
    body.class ?? null,
    body.race ?? null,
    body.background ?? null,
    body.portrait ?? null,
    JSON.stringify({ ...body, id }),
    now,
    now
  );
  return NextResponse.json({ id });
}

export async function GET() {
  const rows = getDb()
    .prepare<[], { id: string; name: string; class: string | null; race: string | null; level: number; portrait: string | null; updated_at: number }>(
      "SELECT id, name, class, race, level, portrait, updated_at FROM character ORDER BY updated_at DESC"
    )
    .all();
  return NextResponse.json({ characters: rows });
}
