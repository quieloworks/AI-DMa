import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { getApiKey, getProvidersConfig, type ImageConfig } from "./config";
import { getDb } from "@/lib/db";

export type ImageGenInput = {
  prompt: string;
  size?: ImageConfig["size"];
  style?: ImageConfig["style"];
  tags?: string[];
  title?: string;
  cacheKey?: string;
  force?: boolean;
  override?: Partial<ImageConfig>;
};

export type ImageGenResult = {
  id: string;
  path: string;
  url: string;
  provider: string;
  model: string;
  mime: string;
  cached?: boolean;
};

const ASSETS_DIR = join(process.cwd(), "data", "assets", "scenes");

function ensureDir() {
  if (!existsSync(ASSETS_DIR)) mkdirSync(ASSETS_DIR, { recursive: true });
}

function mimeFor(ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  if (e === "jpg" || e === "jpeg") return "image/jpeg";
  if (e === "webp") return "image/webp";
  if (e === "gif") return "image/gif";
  return "image/png";
}

function lookupCachedAsset(cacheKey: string): ImageGenResult | null {
  const row = getDb()
    .prepare<string, { id: string; path: string }>(
      "SELECT id, path FROM asset WHERE cache_key = ? LIMIT 1"
    )
    .get(cacheKey);
  if (!row) return null;
  if (!existsSync(row.path)) {
    getDb().prepare("DELETE FROM asset WHERE id = ?").run(row.id);
    return null;
  }
  return {
    id: row.id,
    path: row.path,
    url: `/api/asset/${row.id}`,
    provider: "cache",
    model: "cache",
    mime: mimeFor(extname(row.path)),
    cached: true,
  };
}

function saveAsset(
  bytes: Buffer,
  ext: string,
  meta: { title?: string; tags?: string[]; cacheKey?: string }
): ImageGenResult {
  ensureDir();
  const id = randomUUID();
  const filename = `${id}.${ext}`;
  const absolute = join(ASSETS_DIR, filename);
  writeFileSync(absolute, bytes);
  const relative = `/api/asset/${id}`;
  const db = getDb();

  if (meta.cacheKey) {
    const prior = db
      .prepare<string, { id: string }>("SELECT id FROM asset WHERE cache_key = ?")
      .get(meta.cacheKey);
    if (prior) {
      db.prepare("UPDATE asset SET cache_key = NULL WHERE id = ?").run(prior.id);
    }
  }

  db.prepare(
    "INSERT INTO asset(id, kind, title, path, tags, cache_key, created_at) VALUES(?, 'scene', ?, ?, ?, ?, ?)"
  ).run(
    id,
    meta.title ?? null,
    absolute,
    meta.tags?.join(",") ?? null,
    meta.cacheKey ?? null,
    Date.now()
  );
  return { id, path: absolute, url: relative, provider: "", model: "", mime: mimeFor(ext) };
}

export async function generateImage(input: ImageGenInput): Promise<ImageGenResult> {
  if (input.cacheKey && !input.force) {
    const hit = lookupCachedAsset(input.cacheKey);
    if (hit) return hit;
  }

  const base = getProvidersConfig().image;
  const cfg: ImageConfig = { ...base, ...(input.override ?? {}) };
  if (cfg.provider === "none") throw new Error("La generación de imágenes está desactivada.");

  switch (cfg.provider) {
    case "openai":
      return openAIGenerate(input, cfg);
    case "gemini":
      return geminiGenerate(input, cfg);
    case "stability":
      return stabilityGenerate(input, cfg);
    case "grok":
      return grokGenerate(input, cfg);
    default:
      throw new Error(`Proveedor de imágenes no soportado: ${cfg.provider}`);
  }
}

async function openAIGenerate(input: ImageGenInput, cfg: ImageConfig): Promise<ImageGenResult> {
  const key = getApiKey("openai");
  if (!key) throw new Error("Falta OPENAI_API_KEY.");
  const body: Record<string, unknown> = {
    model: cfg.model || "gpt-image-1",
    prompt: input.prompt,
    size: input.size ?? cfg.size,
    n: 1,
  };
  if (cfg.model === "dall-e-3" && (input.style ?? cfg.style)) {
    body.style = input.style ?? cfg.style;
    body.response_format = "b64_json";
  }
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`openai image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data: Array<{ b64_json?: string; url?: string }> };
  const entry = json.data?.[0];
  if (!entry) throw new Error("OpenAI no devolvió imagen.");
  let bytes: Buffer;
  if (entry.b64_json) bytes = Buffer.from(entry.b64_json, "base64");
  else if (entry.url) bytes = Buffer.from(await (await fetch(entry.url)).arrayBuffer());
  else throw new Error("respuesta de imagen inesperada.");
  const saved = saveAsset(bytes, "png", { title: input.title, tags: input.tags, cacheKey: input.cacheKey });
  return { ...saved, provider: "openai", model: body.model as string };
}

async function geminiGenerate(input: ImageGenInput, cfg: ImageConfig): Promise<ImageGenResult> {
  const key = getApiKey("gemini");
  if (!key) throw new Error("Falta GEMINI_API_KEY.");
  const model = cfg.model || "imagen-3.0-generate-002";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;
  const aspectRatio = deriveAspect(input.size ?? cfg.size);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: input.prompt }],
      parameters: { sampleCount: 1, aspectRatio },
    }),
  });
  if (!res.ok) throw new Error(`gemini image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }> };
  const p = json.predictions?.[0];
  if (!p?.bytesBase64Encoded) throw new Error("Gemini no devolvió imagen.");
  const bytes = Buffer.from(p.bytesBase64Encoded, "base64");
  const ext = p.mimeType?.includes("jpeg") ? "jpg" : "png";
  const saved = saveAsset(bytes, ext, { title: input.title, tags: input.tags, cacheKey: input.cacheKey });
  return { ...saved, provider: "gemini", model };
}

function grokAspectRatio(size: ImageConfig["size"]): string {
  switch (size) {
    case "1024x1536":
      return "2:3";
    case "1536x1024":
    case "1792x1024":
      return "3:2";
    default:
      return "1:1";
  }
}

async function grokGenerate(input: ImageGenInput, cfg: ImageConfig): Promise<ImageGenResult> {
  const key = getApiKey("grok");
  if (!key) throw new Error("Falta XAI_API_KEY.");
  const model = cfg.model || "grok-imagine-image";
  const body: Record<string, unknown> = {
    model,
    prompt: input.prompt,
    n: 1,
    response_format: "b64_json",
    aspect_ratio: grokAspectRatio(input.size ?? cfg.size),
  };
  const res = await fetch("https://api.x.ai/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`grok image ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const entry = json.data?.[0];
  if (!entry) throw new Error("Grok no devolvió imagen.");
  let bytes: Buffer;
  if (entry.b64_json) bytes = Buffer.from(entry.b64_json, "base64");
  else if (entry.url) bytes = Buffer.from(await (await fetch(entry.url)).arrayBuffer());
  else throw new Error("respuesta de imagen inesperada.");
  const saved = saveAsset(bytes, "png", { title: input.title, tags: input.tags, cacheKey: input.cacheKey });
  return { ...saved, provider: "grok", model };
}

async function stabilityGenerate(input: ImageGenInput, cfg: ImageConfig): Promise<ImageGenResult> {
  const key = getApiKey("stability");
  if (!key) throw new Error("Falta STABILITY_API_KEY.");
  const model = cfg.model || "core";
  const url = `https://api.stability.ai/v2beta/stable-image/generate/${model}`;
  const form = new FormData();
  form.append("prompt", input.prompt);
  form.append("output_format", "png");
  const aspect = deriveAspect(input.size ?? cfg.size);
  form.append("aspect_ratio", aspect);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
    body: form,
  });
  if (!res.ok) throw new Error(`stability ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const saved = saveAsset(bytes, "png", { title: input.title, tags: input.tags, cacheKey: input.cacheKey });
  return { ...saved, provider: "stability", model };
}

function deriveAspect(size: ImageConfig["size"]): string {
  switch (size) {
    case "1024x1536":
      return "2:3";
    case "1536x1024":
    case "1792x1024":
      return "3:2";
    default:
      return "1:1";
  }
}
