import { getApiKey, getProvidersConfig, type VoiceConfig } from "./config";
import {
  checkSystemTts,
  emotionToSpeakingRate,
  resolveSystemVoice,
  synthesizeToWav,
} from "@/server/system-tts";

export type VoiceInput = {
  text: string;
  emotion?: string;
  voice?: string;
  override?: Partial<VoiceConfig>;
};

export type VoiceResult =
  | { kind: "fallback"; reason: string }
  | { kind: "stream"; body: ReadableStream<Uint8Array>; contentType: string };

export async function synthesizeVoice(input: VoiceInput): Promise<VoiceResult> {
  const cfg: VoiceConfig = { ...getProvidersConfig().voice, ...(input.override ?? {}) };

  switch (cfg.provider) {
    case "browser":
      return { kind: "fallback", reason: "browser-configured" };
    case "system":
      return systemTts(input, cfg);
    case "openai":
      return openAITts(input, cfg);
    case "elevenlabs":
      return elevenTts(input, cfg);
    default:
      return { kind: "fallback", reason: "provider-unknown" };
  }
}

async function systemTts(input: VoiceInput, cfg: VoiceConfig): Promise<VoiceResult> {
  const status = await checkSystemTts();
  if (!status.ok) {
    return { kind: "fallback", reason: status.detail ?? "tts-sistema-no-disponible" };
  }
  try {
    const voice = resolveSystemVoice(input.voice ?? cfg.voice);
    const wav = await synthesizeToWav(input.text, {
      voice,
      rate: emotionToSpeakingRate(input.emotion),
    });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(wav));
        controller.close();
      },
    });
    return { kind: "stream", body, contentType: "audio/wav" };
  } catch (err) {
    console.error("[system-tts]", err);
    return { kind: "fallback", reason: "tts-sistema-error" };
  }
}

async function openAITts(input: VoiceInput, cfg: VoiceConfig): Promise<VoiceResult> {
  const key = getApiKey("openai");
  if (!key) return { kind: "fallback", reason: "falta-openai-key" };

  const voice = input.voice ?? cfg.voice ?? "alloy";
  const model = cfg.model || "gpt-4o-mini-tts";
  const format = cfg.format === "wav" ? "wav" : "mp3";

  const body: Record<string, unknown> = {
    model,
    voice,
    input: input.text,
    format,
  };
  if (model.startsWith("gpt-4o")) {
    body.instructions = instructionsForEmotion(input.emotion);
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    return { kind: "fallback", reason: `openai-${res.status}: ${(await res.text()).slice(0, 120)}` };
  }
  return {
    kind: "stream",
    body: res.body,
    contentType: format === "wav" ? "audio/wav" : "audio/mpeg",
  };
}

async function elevenTts(input: VoiceInput, cfg: VoiceConfig): Promise<VoiceResult> {
  const key = getApiKey("elevenlabs");
  if (!key) return { kind: "fallback", reason: "falta-elevenlabs-key" };
  const voiceId = input.voice ?? cfg.voice;
  if (!voiceId) return { kind: "fallback", reason: "voice_id no configurado" };
  const model = cfg.model || "eleven_multilingual_v2";
  const stability = input.emotion === "calmo" || input.emotion === "calm" ? 0.65 : 0.4;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: input.text,
      model_id: model,
      voice_settings: { stability, similarity_boost: 0.75, style: emotionStyle(input.emotion) },
    }),
  });
  if (!res.ok || !res.body) {
    return { kind: "fallback", reason: `elevenlabs-${res.status}: ${(await res.text()).slice(0, 120)}` };
  }
  return { kind: "stream", body: res.body, contentType: "audio/mpeg" };
}

function instructionsForEmotion(emotion?: string): string {
  switch (emotion) {
    case "epic":
    case "epica":
      return "Narración épica, con intensidad y ritmo creciente.";
    case "suspense":
    case "suspenso":
      return "Tono de suspenso: pausas medidas, voz grave y tensa.";
    case "calmo":
    case "calm":
      return "Tono sereno y cálido, pausas suaves.";
    case "urgente":
    case "urgent":
      return "Voz urgente y rápida, con energía alta.";
    default:
      return "Narración clara y cinematográfica en español.";
  }
}

function emotionStyle(emotion?: string): number {
  switch (emotion) {
    case "epic":
    case "epica":
      return 0.7;
    case "suspense":
    case "suspenso":
      return 0.55;
    case "urgente":
    case "urgent":
      return 0.8;
    case "calmo":
    case "calm":
      return 0.25;
    default:
      return 0.4;
  }
}

