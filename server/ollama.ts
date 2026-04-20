import { Ollama } from "ollama";

const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";

export const CHAT_MODEL = process.env.DND_MODEL ?? "gemma4:e2b";
export const EMBED_MODEL = process.env.DND_EMBED_MODEL ?? "nomic-embed-text";

export const ollama = new Ollama({ host });

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export async function* chatStream(messages: ChatMsg[], opts: { temperature?: number } = {}) {
  const stream = await ollama.chat({
    model: CHAT_MODEL,
    messages,
    stream: true,
    options: {
      temperature: opts.temperature ?? 0.8,
    },
  });
  for await (const chunk of stream) {
    if (chunk.message?.content) yield chunk.message.content;
  }
}

export async function chatJson(messages: ChatMsg[], opts: { temperature?: number } = {}) {
  const res = await ollama.chat({
    model: CHAT_MODEL,
    messages,
    stream: false,
    format: "json",
    options: { temperature: opts.temperature ?? 0.4 },
  });
  return res.message?.content ?? "";
}

export async function embed(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) {
    try {
      const r = await ollama.embeddings({ model: EMBED_MODEL, prompt: t });
      out.push(r.embedding);
    } catch (err) {
      console.warn("embed error", err);
      out.push(new Array(768).fill(0));
    }
  }
  return out;
}

export async function ensureModelsAvailable(): Promise<{
  chat: boolean;
  embed: boolean;
  installed: string[];
}> {
  try {
    const list = await ollama.list();
    const names = list.models.map((m) => m.name);
    return {
      chat: names.some((n) => n.startsWith(CHAT_MODEL.split(":")[0])),
      embed: names.some((n) => n.startsWith(EMBED_MODEL.split(":")[0])),
      installed: names,
    };
  } catch {
    return { chat: false, embed: false, installed: [] };
  }
}
