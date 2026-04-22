import { NextRequest, NextResponse } from "next/server";
import { retrieveRules } from "@/server/rag";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { query: string; section?: string; k?: number };
  if (!body?.query) return NextResponse.json({ error: serverT("errors.queryRequired") }, { status: 400 });
  const results = await retrieveRules(body.query, { section: body.section, k: body.k });
  return NextResponse.json({ results });
}
