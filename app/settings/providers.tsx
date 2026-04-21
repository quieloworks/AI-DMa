"use client";

import { useEffect, useMemo, useState } from "react";

type ProviderCatalogEntry = {
  id: string;
  label: string;
  defaultModel?: string;
  models?: string[];
  requiresKey: boolean;
  notes?: string;
};

type KeyProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "groq"
  | "grok"
  | "stability"
  | "elevenlabs"
  | "custom";

type ProvidersPayload = {
  config: {
    chat: { provider: string; model: string; baseUrl?: string; temperature?: number };
    image: { provider: string; model: string; size: string; style?: string };
    voice: { provider: string; model: string; voice: string; format?: string };
  };
  keys: Array<{ provider: KeyProvider; source: "db" | "env" | "none"; preview: string }>;
  catalog: {
    chat: ProviderCatalogEntry[];
    image: ProviderCatalogEntry[];
    voice: ProviderCatalogEntry[];
    openaiVoices: string[];
  };
};

const KEY_PROVIDERS_FOR_CHAT: Record<string, KeyProvider | null> = {
  ollama: null,
  openai: "openai",
  anthropic: "anthropic",
  gemini: "gemini",
  openrouter: "openrouter",
  groq: "groq",
  grok: "grok",
  custom: "custom",
};
const KEY_PROVIDERS_FOR_IMAGE: Record<string, KeyProvider | null> = {
  none: null,
  openai: "openai",
  gemini: "gemini",
  stability: "stability",
  grok: "grok",
};
const KEY_PROVIDERS_FOR_VOICE: Record<string, KeyProvider | null> = {
  system: null,
  browser: null,
  openai: "openai",
  elevenlabs: "elevenlabs",
};

export function ProvidersPanel({ initial }: { initial: ProvidersPayload }) {
  const [state, setState] = useState(initial);
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; detail: string }>>({});

  const chatCat = useMemo(
    () => state.catalog.chat.find((p) => p.id === state.config.chat.provider),
    [state.catalog.chat, state.config.chat.provider]
  );
  const imageCat = useMemo(
    () => state.catalog.image.find((p) => p.id === state.config.image.provider),
    [state.catalog.image, state.config.image.provider]
  );
  const voiceCat = useMemo(
    () => state.catalog.voice.find((p) => p.id === state.config.voice.provider),
    [state.catalog.voice, state.config.voice.provider]
  );

  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(t);
  }, [savedAt]);

  async function save() {
    setSaving(true);
    const keyUpdates = Object.entries(keyDraft)
      .filter(([, v]) => typeof v === "string")
      .map(([provider, value]) => ({ provider: provider as KeyProvider, value: value.trim() || null }));
    const res = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: state.config, keys: keyUpdates }),
    });
    if (res.ok) {
      const payload = (await res.json()) as { config: ProvidersPayload["config"]; keys: ProvidersPayload["keys"] };
      setState((prev) => ({ ...prev, config: payload.config, keys: payload.keys }));
      setKeyDraft({});
      setSavedAt(Date.now());
    }
    setSaving(false);
  }

  async function runTest(target: "chat" | "image" | "voice") {
    setTesting(target);
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const data = (await res.json()) as { ok: boolean; latencyMs?: number; sample?: string; error?: string; reason?: string; url?: string };
      if (data.ok) {
        setTestResult((prev) => ({
          ...prev,
          [target]: {
            ok: true,
            detail: [
              data.latencyMs ? `${data.latencyMs}ms` : null,
              data.sample ? `→ ${data.sample}` : null,
              data.url ? "imagen creada" : null,
            ]
              .filter(Boolean)
              .join(" · "),
          },
        }));
      } else {
        setTestResult((prev) => ({ ...prev, [target]: { ok: false, detail: data.error ?? data.reason ?? "falló" } }));
      }
    } catch (err) {
      setTestResult((prev) => ({ ...prev, [target]: { ok: false, detail: (err as Error).message } }));
    } finally {
      setTesting(null);
    }
  }

  const relevantKeyProviders = useMemo(() => {
    const set = new Set<KeyProvider>();
    const chatKey = KEY_PROVIDERS_FOR_CHAT[state.config.chat.provider];
    if (chatKey) set.add(chatKey);
    const imgKey = KEY_PROVIDERS_FOR_IMAGE[state.config.image.provider];
    if (imgKey) set.add(imgKey);
    const voiceKey = KEY_PROVIDERS_FOR_VOICE[state.config.voice.provider];
    if (voiceKey) set.add(voiceKey);
    return Array.from(set);
  }, [state.config]);

  return (
    <div className="space-y-6">
      <Section
        title="Chat / narrativa"
        description="Elige el cerebro que conduce al DM. Ollama corre en tu máquina; los demás necesitan API key."
        action={
          <TestButton
            ok={testResult.chat?.ok}
            detail={testResult.chat?.detail}
            busy={testing === "chat"}
            onClick={() => runTest("chat")}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Proveedor">
            <select
              className="input"
              value={state.config.chat.provider}
              onChange={(e) => {
                const id = e.target.value;
                const cat = state.catalog.chat.find((c) => c.id === id);
                setState((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    chat: { ...prev.config.chat, provider: id, model: cat?.defaultModel ?? prev.config.chat.model },
                  },
                }));
              }}
            >
              {state.catalog.chat.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modelo">
            {chatCat?.models && chatCat.models.length > 0 ? (
              <div className="flex gap-2">
                <select
                  className="input"
                  value={chatCat.models.includes(state.config.chat.model) ? state.config.chat.model : "__custom__"}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "__custom__") return;
                    setState((prev) => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, model: v } } }));
                  }}
                >
                  {chatCat.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  <option value="__custom__">Personalizado…</option>
                </select>
                <input
                  className="input"
                  placeholder="modelo custom"
                  value={state.config.chat.model}
                  onChange={(e) =>
                    setState((prev) => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, model: e.target.value } } }))
                  }
                />
              </div>
            ) : (
              <input
                className="input"
                value={state.config.chat.model}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, model: e.target.value } } }))
                }
              />
            )}
          </Field>
          <Field label="Temperatura" help="0 = preciso · 1 = creativo">
            <input
              className="input"
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={state.config.chat.temperature ?? 0.8}
              onChange={(e) =>
                setState((prev) => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, temperature: Number(e.target.value) } } }))
              }
            />
          </Field>
        </div>
        {(state.config.chat.provider === "custom" || state.config.chat.provider === "ollama") && (
          <div className="mt-3">
            <Field
              label={state.config.chat.provider === "custom" ? "Base URL (OpenAI-compatible)" : "Host de Ollama (opcional)"}
              help={state.config.chat.provider === "custom" ? "https://mi-gateway/v1" : "http://127.0.0.1:11434 por defecto"}
            >
              <input
                className="input"
                value={state.config.chat.baseUrl ?? ""}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, config: { ...prev.config, chat: { ...prev.config.chat, baseUrl: e.target.value } } }))
                }
              />
            </Field>
          </div>
        )}
        {chatCat?.notes && <Note>{chatCat.notes}</Note>}
      </Section>

      <Section
        title="Imágenes de escena"
        description="Para retratos, mapas y ambiente. Si está desactivado, la app usa el canvas procedural."
        action={
          <TestButton
            ok={testResult.image?.ok}
            detail={testResult.image?.detail}
            busy={testing === "image"}
            onClick={() => runTest("image")}
            disabled={state.config.image.provider === "none"}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Proveedor">
            <select
              className="input"
              value={state.config.image.provider}
              onChange={(e) => {
                const id = e.target.value;
                const cat = state.catalog.image.find((c) => c.id === id);
                setState((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    image: { ...prev.config.image, provider: id, model: cat?.defaultModel ?? "" },
                  },
                }));
              }}
            >
              {state.catalog.image.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modelo">
            <select
              className="input"
              value={state.config.image.model}
              disabled={state.config.image.provider === "none"}
              onChange={(e) =>
                setState((prev) => ({ ...prev, config: { ...prev.config, image: { ...prev.config.image, model: e.target.value } } }))
              }
            >
              {(imageCat?.models ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tamaño">
            <select
              className="input"
              value={state.config.image.size}
              disabled={state.config.image.provider === "none"}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  config: { ...prev.config, image: { ...prev.config.image, size: e.target.value as ProvidersPayload["config"]["image"]["size"] } },
                }))
              }
            >
              <option value="1024x1024">Cuadrado 1024²</option>
              <option value="1024x1536">Retrato 1024×1536</option>
              <option value="1536x1024">Paisaje 1536×1024</option>
              <option value="1792x1024">Pano 1792×1024</option>
              <option value="512x512">Bocetos 512²</option>
            </select>
          </Field>
        </div>
        {imageCat?.notes && <Note>{imageCat.notes}</Note>}
      </Section>

      <Section
        title="Voz narrada"
        description="La voz del sistema (say / espeak-ng) es gratuita y no usa red. OpenAI/ElevenLabs ofrecen voces más expresivas."
        action={
          <TestButton
            ok={testResult.voice?.ok}
            detail={testResult.voice?.detail}
            busy={testing === "voice"}
            onClick={() => runTest("voice")}
            disabled={state.config.voice.provider === "browser"}
          />
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Proveedor">
            <select
              className="input"
              value={state.config.voice.provider}
              onChange={(e) => {
                const id = e.target.value;
                const cat = state.catalog.voice.find((c) => c.id === id);
                setState((prev) => ({
                  ...prev,
                  config: {
                    ...prev.config,
                    voice: {
                      ...prev.config.voice,
                      provider: id,
                      model: cat?.defaultModel ?? "",
                      voice: id === "openai" ? "coral" : id === "system" ? (cat?.defaultModel ?? prev.config.voice.voice) : prev.config.voice.voice,
                    },
                  },
                }));
              }}
            >
              {state.catalog.voice.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Modelo">
            {voiceCat?.models && voiceCat.models.length > 0 ? (
              <select
                className="input"
                value={state.config.voice.model}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, config: { ...prev.config, voice: { ...prev.config.voice, model: e.target.value } } }))
                }
              >
                {voiceCat.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                placeholder="(opcional)"
                value={state.config.voice.model}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, config: { ...prev.config, voice: { ...prev.config.voice, model: e.target.value } } }))
                }
              />
            )}
          </Field>
          <Field label={state.config.voice.provider === "elevenlabs" ? "voice_id" : state.config.voice.provider === "openai" ? "Voz" : "Voz (sistema)"}>
            {state.config.voice.provider === "openai" ? (
              <select
                className="input"
                value={state.config.voice.voice}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, config: { ...prev.config, voice: { ...prev.config.voice, voice: e.target.value } } }))
                }
              >
                {state.catalog.openaiVoices.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="input"
                value={state.config.voice.voice}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, config: { ...prev.config, voice: { ...prev.config.voice, voice: e.target.value } } }))
                }
              />
            )}
          </Field>
        </div>
        {voiceCat?.notes && <Note>{voiceCat.notes}</Note>}
      </Section>

      <Section title="API keys" description="Se guardan cifradas en data/dnd.db con AES-256-GCM y un secreto local.">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {state.keys.map((k) => {
            const needed = relevantKeyProviders.includes(k.provider);
            const draft = keyDraft[k.provider];
            return (
              <div
                key={k.provider}
                className={`rounded-md border p-3 ${needed ? "" : "opacity-70"}`}
                style={{ borderColor: needed ? "var(--color-border-strong)" : "var(--color-border)" }}
              >
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    {k.provider.toUpperCase()}
                  </span>
                  <KeyBadge source={k.source} preview={k.preview} />
                </div>
                <div className="flex gap-2">
                  <input
                    className="input"
                    type="password"
                    placeholder={k.source === "none" ? "sk-..." : "Deja vacío para mantener"}
                    value={draft ?? ""}
                    onChange={(e) => setKeyDraft((prev) => ({ ...prev, [k.provider]: e.target.value }))}
                  />
                  {k.source === "db" && (
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setKeyDraft((prev) => ({ ...prev, [k.provider]: "" }))}
                      title="Eliminar al guardar"
                    >
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <Note>
          También puedes exponer variables de entorno: <code>OPENAI_API_KEY</code>, <code>ANTHROPIC_API_KEY</code>, <code>GEMINI_API_KEY</code>,
          <code> OPENROUTER_API_KEY</code>, <code>GROQ_API_KEY</code>, <code>XAI_API_KEY</code>, <code>STABILITY_API_KEY</code>, <code>ELEVENLABS_API_KEY</code>.
        </Note>
      </Section>

      <div className="flex items-center gap-3">
        <button className="btn-accent" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar proveedores"}
        </button>
        {savedAt && <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>Actualizado.</span>}
      </div>
    </div>
  );
}

function Section({
  title,
  description,
  children,
  action,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg p-5" style={{ background: "var(--color-bg-tertiary)", border: "0.5px solid var(--color-border)" }}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h3 className="mb-1">{title}</h3>
          {description && (
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {help && <p className="mb-1 text-[11px]" style={{ color: "var(--color-text-hint)" }}>{help}</p>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
      {children}
    </p>
  );
}

function KeyBadge({ source, preview }: { source: "db" | "env" | "none"; preview: string }) {
  if (source === "none") return <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>sin configurar</span>;
  const label = source === "db" ? "guardada" : ".env";
  return (
    <span className="badge" style={{ fontSize: "10px" }}>
      {label} · {preview}
    </span>
  );
}

function TestButton({
  ok,
  detail,
  busy,
  onClick,
  disabled,
}: {
  ok?: boolean;
  detail?: string;
  busy: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" className="btn-ghost" onClick={onClick} disabled={busy || disabled}>
        {busy ? "Probando…" : "Probar"}
      </button>
      {typeof ok === "boolean" && (
        <span className="text-[11px]" style={{ color: ok ? "var(--color-accent-text)" : "#f09595" }}>
          {ok ? "✓" : "✗"} {detail}
        </span>
      )}
    </div>
  );
}
