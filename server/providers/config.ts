import { getDb, getSetting, setSetting } from "@/lib/db";
import { decryptString, encryptString, maskKey } from "./crypto";
import type { ChatProviderId, ImageProviderId, VoiceProviderId } from "./catalog";

export type ChatConfig = {
  provider: ChatProviderId;
  model: string;
  baseUrl?: string;
  temperature?: number;
};

export type ImageConfig = {
  provider: ImageProviderId;
  model: string;
  size: "512x512" | "1024x1024" | "1024x1536" | "1536x1024" | "1792x1024";
  style?: "vivid" | "natural";
};

export type VoiceConfig = {
  provider: VoiceProviderId;
  model: string;
  voice: string;
  format?: "mp3" | "wav";
};

export type ProvidersConfig = {
  chat: ChatConfig;
  image: ImageConfig;
  voice: VoiceConfig;
};

const PROVIDERS_KEY = "providers";

const DEFAULTS: ProvidersConfig = {
  chat: {
    provider: "ollama",
    model: process.env.DND_MODEL ?? "gemma4:e2b",
    temperature: 0.8,
  },
  image: {
    provider: "none",
    model: "",
    size: "1024x1024",
    style: "vivid",
  },
  voice: {
    provider: "piper",
    model: "",
    voice: "es_MX-claude-high",
    format: "wav",
  },
};

export function getProvidersConfig(): ProvidersConfig {
  const stored = getSetting<Partial<ProvidersConfig>>(PROVIDERS_KEY, {});
  return {
    chat: { ...DEFAULTS.chat, ...(stored.chat ?? {}) },
    image: { ...DEFAULTS.image, ...(stored.image ?? {}) },
    voice: { ...DEFAULTS.voice, ...(stored.voice ?? {}) },
  };
}

export function saveProvidersConfig(update: Partial<ProvidersConfig>) {
  const current = getProvidersConfig();
  const next: ProvidersConfig = {
    chat: { ...current.chat, ...(update.chat ?? {}) },
    image: { ...current.image, ...(update.image ?? {}) },
    voice: { ...current.voice, ...(update.voice ?? {}) },
  };
  setSetting(PROVIDERS_KEY, next);
  return next;
}

export type KeyProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "groq"
  | "stability"
  | "elevenlabs"
  | "custom";

const ENV_FALLBACK: Record<KeyProvider, string | undefined> = {
  openai: process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  gemini: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  groq: process.env.GROQ_API_KEY,
  stability: process.env.STABILITY_API_KEY,
  elevenlabs: process.env.ELEVENLABS_API_KEY,
  custom: process.env.DND_CUSTOM_API_KEY,
};

export function getApiKey(provider: KeyProvider): string | null {
  try {
    const row = getDb()
      .prepare<string, { encrypted: string }>("SELECT encrypted FROM api_key WHERE provider = ?")
      .get(provider);
    if (row?.encrypted) return decryptString(row.encrypted);
  } catch (err) {
    console.warn("no pude descifrar api_key", provider, (err as Error).message);
  }
  return ENV_FALLBACK[provider] ?? null;
}

export function setApiKey(provider: KeyProvider, key: string | null) {
  const db = getDb();
  if (!key) {
    db.prepare("DELETE FROM api_key WHERE provider = ?").run(provider);
    return;
  }
  const encrypted = encryptString(key.trim());
  db.prepare(
    "INSERT OR REPLACE INTO api_key(provider, encrypted, updated_at) VALUES(?, ?, ?)"
  ).run(provider, encrypted, Date.now());
}

export function listConfiguredKeys(): Array<{ provider: KeyProvider; source: "db" | "env" | "none"; preview: string }> {
  const providers: KeyProvider[] = [
    "openai",
    "anthropic",
    "gemini",
    "openrouter",
    "groq",
    "stability",
    "elevenlabs",
    "custom",
  ];
  const db = getDb();
  return providers.map((p) => {
    const row = db
      .prepare<string, { encrypted: string }>("SELECT encrypted FROM api_key WHERE provider = ?")
      .get(p);
    if (row?.encrypted) {
      try {
        return { provider: p, source: "db" as const, preview: maskKey(decryptString(row.encrypted)) };
      } catch {
        return { provider: p, source: "db" as const, preview: "••••" };
      }
    }
    if (ENV_FALLBACK[p]) {
      return { provider: p, source: "env" as const, preview: maskKey(ENV_FALLBACK[p] ?? "") };
    }
    return { provider: p, source: "none" as const, preview: "" };
  });
}
