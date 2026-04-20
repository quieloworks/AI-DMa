"use client";

import { useState } from "react";

type Settings = {
  diceDm: "auto" | "manual";
  diceDefault: "auto" | "manual";
  voice: string;
  sfx: boolean;
  defaultMode: "auto" | "assistant";
};

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState<Settings>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setSaving(false);
    setSavedAt(Date.now());
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Pair label="Dados del DM" help="¿La app tira automáticamente o el DM reporta manualmente?">
        <Toggle value={s.diceDm} options={[{ v: "auto", l: "Automático" }, { v: "manual", l: "Manual" }]} onChange={(v) => setS({ ...s, diceDm: v as "auto" | "manual" })} />
      </Pair>
      <Pair label="Dados de jugadores (por defecto)" help="Cada jugador puede sobreescribirlo en su celular.">
        <Toggle value={s.diceDefault} options={[{ v: "auto", l: "Automático" }, { v: "manual", l: "Manual" }]} onChange={(v) => setS({ ...s, diceDefault: v as "auto" | "manual" })} />
      </Pair>
      <Pair label="Modo DM por defecto">
        <Toggle value={s.defaultMode} options={[{ v: "auto", l: "Automático" }, { v: "assistant", l: "Asistente" }]} onChange={(v) => setS({ ...s, defaultMode: v as "auto" | "assistant" })} />
      </Pair>
      <Pair label="Efectos de sonido">
        <Toggle value={s.sfx ? "on" : "off"} options={[{ v: "on", l: "Activados" }, { v: "off", l: "Silencio" }]} onChange={(v) => setS({ ...s, sfx: v === "on" })} />
      </Pair>
      <Pair label="Voz (Piper)" help="Modelo ONNX en data/voices/">
        <input className="input" value={s.voice} onChange={(e) => setS({ ...s, voice: e.target.value })} />
      </Pair>

      <div className="flex items-center gap-3 md:col-span-2">
        <button className="btn-accent" onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
        {savedAt && <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>Guardado.</span>}
      </div>
    </div>
  );
}

function Pair({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {help && <p className="mb-1 text-xs" style={{ color: "var(--color-text-hint)" }}>{help}</p>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

function Toggle({ value, options, onChange }: { value: string; options: { v: string; l: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className={value === o.v ? "btn-accent" : "btn-ghost"}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
