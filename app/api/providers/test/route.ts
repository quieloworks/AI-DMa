import { NextRequest, NextResponse } from "next/server";
import { chatComplete } from "@/server/providers/chat";
import { generateImage } from "@/server/providers/image";
import { synthesizeVoice } from "@/server/providers/voice";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

type TestReq = {
  target: "chat" | "image" | "voice";
};

export async function POST(req: NextRequest) {
  const { target } = (await req.json()) as TestReq;
  const t0 = Date.now();
  try {
    if (target === "chat") {
      const out = await chatComplete(
        [
          { role: "system", content: serverT("providersTest.chatSystem") },
          { role: "user", content: serverT("providersTest.chatUser") },
        ],
        { maxTokens: 16 }
      );
      return NextResponse.json({ ok: true, latencyMs: Date.now() - t0, sample: out.trim() });
    }
    if (target === "image") {
      const res = await generateImage({ prompt: "Pequeño test: escena medieval de prueba, minimalista.", title: "test" });
      return NextResponse.json({ ok: true, latencyMs: Date.now() - t0, url: res.url, provider: res.provider });
    }
    if (target === "voice") {
      const res = await synthesizeVoice({ text: serverT("providersTest.voiceSample") });
      if (res.kind === "fallback") return NextResponse.json({ ok: false, reason: res.reason }, { status: 400 });
      await res.body.cancel();
      return NextResponse.json({ ok: true, latencyMs: Date.now() - t0, contentType: res.contentType });
    }
    return NextResponse.json({ ok: false, error: serverT("errors.unknownTarget") }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
