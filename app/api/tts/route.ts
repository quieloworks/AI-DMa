import { NextRequest, NextResponse } from "next/server";
import { checkSystemTts } from "@/server/system-tts";
import { synthesizeVoice } from "@/server/providers/voice";
import { getProvidersConfig } from "@/server/providers/config";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function GET() {
  const systemTts = await checkSystemTts();
  const cfg = getProvidersConfig();
  return NextResponse.json({ systemTts, config: cfg.voice });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { text: string; voice?: string; emotion?: string };
  if (!body?.text) return NextResponse.json({ error: serverT("errors.textRequired") }, { status: 400 });

  const result = await synthesizeVoice({ text: body.text, voice: body.voice, emotion: body.emotion });
  if (result.kind === "fallback") {
    // 200 + JSON: el navegador ya tiene fallback (speechSynthesis). 503 ensuciaba logs sin aportar
    // (caso típico: say/espeak-ng no disponible — ver GET /api/tts).
    return NextResponse.json(
      { fallback: "browser", details: result.reason },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  return new Response(result.body as unknown as ReadableStream, {
    headers: { "Content-Type": result.contentType, "Cache-Control": "no-store" },
  });
}
