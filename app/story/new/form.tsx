"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CharacterOpt = { id: string; name: string; class: string | null; race: string | null; level: number };

export function NewStoryForm({ characters }: { characters: CharacterOpt[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [seed, setSeed] = useState("");
  const [mode, setMode] = useState<"auto" | "assistant">("auto");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!title || picked.length === 0) return;
    setBusy(true);
    const res = await fetch("/api/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, mode, seed, playerCharacterIds: picked }),
    });
    const data = (await res.json()) as { sessionId: string };
    router.push(`/story/${data.sessionId}`);
  }

  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="card space-y-4">
        <label className="block">
          <span className="label">Título</span>
          <input className="input mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Las ruinas de Astarel" />
        </label>

        <div>
          <span className="label">Modo del Dungeon Master</span>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => setMode("auto")} className={mode === "auto" ? "btn-accent" : "btn-ghost"}>
              Automático (IA narra todo)
            </button>
            <button type="button" onClick={() => setMode("assistant")} className={mode === "assistant" ? "btn-accent" : "btn-ghost"}>
              Asistente (un jugador es DM)
            </button>
          </div>
        </div>

        <label className="block">
          <span className="label">Semilla / idea de la historia</span>
          <textarea
            className="input mt-2"
            style={{ height: 120, padding: 10 }}
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Un grupo de aventureros despierta en una mazmorra sin recordar cómo llegaron. Escuchan gruñidos lejanos..."
          />
        </label>
      </div>

      <div className="card">
        <p className="label mb-3">Personajes que participan</p>
        {characters.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Crea al menos un personaje antes de iniciar la historia.
          </p>
        ) : (
          <ul className="space-y-2">
            {characters.map((c) => (
              <li key={c.id}>
                <label className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: picked.includes(c.id) ? "var(--color-accent-bg)" : "var(--color-bg-tertiary)" }}>
                  <div>
                    <p className="text-sm">{c.name}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {c.race ?? "?"} · {c.class ?? "?"} nv. {c.level}
                    </p>
                  </div>
                  <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                </label>
              </li>
            ))}
          </ul>
        )}

        <button disabled={busy || !title || picked.length === 0} onClick={submit} className="btn-accent mt-6 w-full">
          {busy ? "Creando…" : "Comenzar la aventura"}
        </button>
      </div>
    </div>
  );
}
