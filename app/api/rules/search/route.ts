import { NextRequest, NextResponse } from "next/server";
import { retrieveRules } from "@/server/rag";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { query: string; section?: string; k?: number };
  if (!body?.query) return NextResponse.json({ error: "query requerida" }, { status: 400 });
  const results = await retrieveRules(body.query, { section: body.section, k: body.k });
  return NextResponse.json({ results });
}
