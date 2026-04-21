import { Ollama } from "ollama";
import { getApiKey, getProvidersConfig, type ChatConfig } from "./config";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export type ChatOpts = {
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  override?: Partial<ChatConfig>;
};

export async function* chatStream(messages: ChatMsg[], opts: ChatOpts = {}): AsyncGenerator<string> {
  const cfg = { ...getProvidersConfig().chat, ...(opts.override ?? {}) };
  switch (cfg.provider) {
    case "ollama":
      yield* streamOllama(messages, cfg, opts);
      return;
    case "openai":
    case "openrouter":
    case "groq":
    case "grok":
    case "custom":
      yield* streamOpenAICompatible(messages, cfg, opts);
      return;
    case "anthropic":
      yield* streamAnthropic(messages, cfg, opts);
      return;
    case "gemini":
      yield* streamGemini(messages, cfg, opts);
      return;
    default:
      throw new Error(`Proveedor de chat no soportado: ${cfg.provider}`);
  }
}

export async function chatComplete(messages: ChatMsg[], opts: ChatOpts = {}): Promise<string> {
  let out = "";
  for await (const tok of chatStream(messages, opts)) out += tok;
  return out;
}

async function* streamOllama(messages: ChatMsg[], cfg: ChatConfig, opts: ChatOpts) {
  const host = cfg.baseUrl ?? process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  const ollama = new Ollama({ host });
  const stream = await ollama.chat({
    model: cfg.model,
    messages,
    stream: true,
    format: opts.json ? "json" : undefined,
    options: { temperature: opts.temperature ?? cfg.temperature ?? 0.8 },
  });
  for await (const chunk of stream) {
    if (chunk.message?.content) yield chunk.message.content;
  }
}

function openAICompatibleBaseUrl(cfg: ChatConfig): string {
  if (cfg.baseUrl) return cfg.baseUrl.replace(/\/+$/, "");
  switch (cfg.provider) {
    case "openai":
      return "https://api.openai.com/v1";
    case "openrouter":
      return "https://openrouter.ai/api/v1";
    case "groq":
      return "https://api.groq.com/openai/v1";
    case "grok":
      return "https://api.x.ai/v1";
    default:
      throw new Error("Para 'custom' define baseUrl en la configuración.");
  }
}

function openAICompatibleKey(cfg: ChatConfig): string | null {
  switch (cfg.provider) {
    case "openai":
      return getApiKey("openai");
    case "openrouter":
      return getApiKey("openrouter");
    case "groq":
      return getApiKey("groq");
    case "grok":
      return getApiKey("grok");
    case "custom":
      return getApiKey("custom");
    default:
      return null;
  }
}

async function* streamOpenAICompatible(messages: ChatMsg[], cfg: ChatConfig, opts: ChatOpts) {
  const baseUrl = openAICompatibleBaseUrl(cfg);
  const apiKey = openAICompatibleKey(cfg);
  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    stream: true,
    temperature: opts.temperature ?? cfg.temperature ?? 0.8,
  };
  if (opts.maxTokens) body.max_tokens = opts.maxTokens;
  if (opts.json) body.response_format = { type: "json_object" };

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...(cfg.provider === "openrouter" ? { "X-Title": "DnD DM Local" } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${cfg.provider} ${res.status}: ${errText.slice(0, 200)}`);
  }

  for await (const event of readSse(res.body)) {
    if (!event || event === "[DONE]") continue;
    try {
      const parsed = JSON.parse(event) as {
        choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>;
      };
      const delta = parsed.choices?.[0]?.delta?.content ?? parsed.choices?.[0]?.message?.content;
      if (delta) yield delta;
    } catch {
      // skip non-json keep-alive pings
    }
  }
}

async function* streamAnthropic(messages: ChatMsg[], cfg: ChatConfig, opts: ChatOpts) {
  const apiKey = getApiKey("anthropic");
  if (!apiKey) throw new Error("Falta ANTHROPIC_API_KEY.");

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const conv = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: cfg.model,
      system: system || undefined,
      messages: conv,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? cfg.temperature ?? 0.8,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${errText.slice(0, 200)}`);
  }

  for await (const event of readSse(res.body)) {
    if (!event) continue;
    try {
      const parsed = JSON.parse(event) as {
        type?: string;
        delta?: { type?: string; text?: string };
      };
      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
        yield parsed.delta.text;
      }
    } catch {
      // ignore ping events
    }
  }
}

async function* streamGemini(messages: ChatMsg[], cfg: ChatConfig, opts: ChatOpts) {
  const apiKey = getApiKey("gemini");
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY.");

  const systemInstruction = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? cfg.temperature ?? 0.8,
      maxOutputTokens: opts.maxTokens ?? 2048,
      ...(opts.json ? { responseMimeType: "application/json" } : {}),
    },
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new Error(`gemini ${res.status}: ${errText.slice(0, 200)}`);
  }

  for await (const event of readSse(res.body)) {
    if (!event || event === "[DONE]") continue;
    try {
      const parsed = JSON.parse(event) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const parts = parsed.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.text) yield part.text;
      }
    } catch {
      // skip
    }
  }
}

async function* readSse(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        const chunk = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        const lines = chunk.split("\n");
        const data = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n");
        if (data) yield data;
        sep = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }
}
