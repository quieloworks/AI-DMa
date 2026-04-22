"use client";

import { useState } from "react";
import type { GlobalSettings } from "@/lib/i18n/global-settings";
import type { AppLocale } from "@/lib/i18n/locale";
import { useTranslations } from "@/components/LocaleProvider";

export function SettingsForm({ initial }: { initial: GlobalSettings }) {
  const tr = useTranslations();
  const [s, setS] = useState<GlobalSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setSaving(false);
    setSavedAt(Date.now());
    window.location.reload();
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Pair label={tr("settings.locale")} help={tr("settings.localeHelp")}>
        <Toggle
          value={s.locale}
          options={[
            { v: "es", l: tr("settings.locale.es") },
            { v: "en", l: tr("settings.locale.en") },
          ]}
          onChange={(v) => setS({ ...s, locale: v as AppLocale })}
        />
      </Pair>
      <Pair label={tr("settings.diceDm")} help={tr("settings.diceDmHelp")}>
        <Toggle
          value={s.diceDm}
          options={[
            { v: "auto", l: tr("settings.auto") },
            { v: "manual", l: tr("settings.manual") },
          ]}
          onChange={(v) => setS({ ...s, diceDm: v as "auto" | "manual" })}
        />
      </Pair>
      <Pair label={tr("settings.diceDefault")} help={tr("settings.diceDefaultHelp")}>
        <Toggle
          value={s.diceDefault}
          options={[
            { v: "auto", l: tr("settings.auto") },
            { v: "manual", l: tr("settings.manual") },
          ]}
          onChange={(v) => setS({ ...s, diceDefault: v as "auto" | "manual" })}
        />
      </Pair>
      <Pair label={tr("settings.modeDefault")}>
        <Toggle
          value={s.defaultMode}
          options={[
            { v: "auto", l: tr("settings.mode.auto") },
            { v: "assistant", l: tr("settings.mode.assistant") },
          ]}
          onChange={(v) => setS({ ...s, defaultMode: v as "auto" | "assistant" })}
        />
      </Pair>
      <Pair label={tr("settings.sfx")}>
        <Toggle
          value={s.sfx ? "on" : "off"}
          options={[
            { v: "on", l: tr("settings.sfxOn") },
            { v: "off", l: tr("settings.sfxOff") },
          ]}
          onChange={(v) => setS({ ...s, sfx: v === "on" })}
        />
      </Pair>
      <Pair label={tr("settings.voice")} help={tr("settings.voiceHelp")}>
        <input className="input" value={s.voice} onChange={(e) => setS({ ...s, voice: e.target.value })} />
      </Pair>

      <div className="flex items-center gap-3 md:col-span-2">
        <button className="btn-accent" onClick={save} disabled={saving}>
          {saving ? tr("settings.saving") : tr("settings.save")}
        </button>
        {savedAt && <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>{tr("settings.saved")}</span>}
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
