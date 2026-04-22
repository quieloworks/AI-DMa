import { NextResponse } from "next/server";
import { readFileSync, existsSync, statSync } from "node:fs";
import { extname } from "node:path";
import { getDb } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".pdf": "application/pdf",
};

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare<string, { path: string; kind: string }>("SELECT path, kind FROM asset WHERE id = ?")
    .get(id);
  if (!row || !existsSync(row.path)) {
    return NextResponse.json({ error: serverT("errors.assetNotFound") }, { status: 404 });
  }
  const ext = extname(row.path).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const file = readFileSync(row.path);
  const stat = statSync(row.path);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
