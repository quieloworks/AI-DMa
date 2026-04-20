import { NextRequest, NextResponse } from "next/server";
import { checkPiper } from "@/server/piper";
import { synthesizeVoice } from "@/server/providers/voice";
import { getProvidersConfig } from "@/server/providers/config";

export const runtime = "nodejs";

export async function GET() {
  const piper = await checkPiper();
  const cfg = getProvidersConfig();
  return NextResponse.json({ piper, config: cfg.voice });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text: string; voice?: string; emotion?: string };
  if (!body?.text) return NextResponse.json({ error: "text requerido" }, { status: 400 });

  const result = await synthesizeVoice({ text: body.text, voice: body.voice, emotion: body.emotion });
  if (result.kind === "fallback") {
    return NextResponse.json({ error: "Proveedor de voz no disponible", details: result.reason, fallback: "browser" }, { status: 503 });
  }

  return new Response(result.body as unknown as ReadableStream, {
    headers: { "Content-Type": result.contentType, "Cache-Control": "no-store" },
  });
}
