import { NextRequest, NextResponse } from "next/server";
import { setSetting, getSetting } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const s = getSetting("global", { diceDm: "auto", diceDefault: "auto", voice: "es_MX-claude-high", sfx: true, defaultMode: "auto" });
  return NextResponse.json(s);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  setSetting("global", body);
  return NextResponse.json({ ok: true });
}
