import { NextRequest, NextResponse } from "next/server";
import {
  getProvidersConfig,
  listConfiguredKeys,
  saveProvidersConfig,
  setApiKey,
  type KeyProvider,
} from "@/server/providers/config";
import { CHAT_CATALOG, IMAGE_CATALOG, OPENAI_TTS_VOICES, VOICE_CATALOG } from "@/server/providers/catalog";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    config: getProvidersConfig(),
    keys: listConfiguredKeys(),
    catalog: {
      chat: CHAT_CATALOG,
      image: IMAGE_CATALOG,
      voice: VOICE_CATALOG,
      openaiVoices: OPENAI_TTS_VOICES,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    config?: Parameters<typeof saveProvidersConfig>[0];
    keys?: Array<{ provider: KeyProvider; value: string | null }>;
  };
  if (body.config) saveProvidersConfig(body.config);
  if (Array.isArray(body.keys)) {
    for (const k of body.keys) setApiKey(k.provider, k.value);
  }
  return NextResponse.json({
    ok: true,
    config: getProvidersConfig(),
    keys: listConfiguredKeys(),
  });
}
