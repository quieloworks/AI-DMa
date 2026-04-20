export type ChatProviderId =
  | "ollama"
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "groq"
  | "custom";

export type ImageProviderId = "none" | "openai" | "gemini" | "stability";

export type VoiceProviderId = "piper" | "openai" | "elevenlabs" | "browser";

export type ProviderCatalogEntry = {
  id: string;
  label: string;
  defaultModel?: string;
  models?: string[];
  requiresKey: boolean;
  notes?: string;
};

export const CHAT_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "ollama",
    label: "Ollama (local)",
    defaultModel: "gemma4:e2b",
    models: ["gemma4:e2b", "llama3.1:8b", "qwen2.5:7b", "mistral:7b"],
    requiresKey: false,
    notes: "Usa modelos instalados con `ollama pull …`.",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1", "gpt-4.1-mini", "o4-mini"],
    requiresKey: true,
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-3-5-haiku-latest",
    models: [
      "claude-3-5-haiku-latest",
      "claude-3-5-sonnet-latest",
      "claude-3-7-sonnet-latest",
      "claude-opus-4-latest",
    ],
    requiresKey: true,
  },
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
    requiresKey: true,
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-4o-mini",
    models: [
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.1-70b-instruct",
    ],
    requiresKey: true,
    notes: "Gateway unificado compatible con la API de OpenAI.",
  },
  {
    id: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    requiresKey: true,
  },
  {
    id: "custom",
    label: "OpenAI-compatible (custom)",
    defaultModel: "",
    requiresKey: false,
    notes: "Define `baseUrl` y, si aplica, API key.",
  },
];

export const IMAGE_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "none",
    label: "Desactivado",
    requiresKey: false,
  },
  {
    id: "openai",
    label: "OpenAI Images",
    defaultModel: "gpt-image-1",
    models: ["gpt-image-1", "dall-e-3"],
    requiresKey: true,
  },
  {
    id: "gemini",
    label: "Google Imagen",
    defaultModel: "imagen-3.0-generate-002",
    models: ["imagen-3.0-generate-002", "imagen-3.0-fast-generate-001"],
    requiresKey: true,
  },
  {
    id: "stability",
    label: "Stability AI",
    defaultModel: "sd3.5-large",
    models: ["sd3.5-large", "sd3.5-medium", "core"],
    requiresKey: true,
  },
];

export const VOICE_CATALOG: ProviderCatalogEntry[] = [
  {
    id: "piper",
    label: "Piper (local)",
    defaultModel: "es_MX-claude-high",
    requiresKey: false,
    notes: "Coloca los modelos .onnx en `data/voices/`.",
  },
  {
    id: "openai",
    label: "OpenAI TTS",
    defaultModel: "gpt-4o-mini-tts",
    models: ["gpt-4o-mini-tts", "tts-1-hd", "tts-1"],
    requiresKey: true,
    notes: "Voces: alloy, ash, ballad, coral, echo, fable, onyx, nova, sage, shimmer, verse.",
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    defaultModel: "eleven_multilingual_v2",
    models: ["eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5"],
    requiresKey: true,
    notes: "Define el voice_id en el campo de voz.",
  },
  {
    id: "browser",
    label: "Web Speech API (navegador)",
    requiresKey: false,
    notes: "Sin servidor; usa la voz del sistema operativo.",
  },
];

export const OPENAI_TTS_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "coral",
  "echo",
  "fable",
  "onyx",
  "nova",
  "sage",
  "shimmer",
  "verse",
];
