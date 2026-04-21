"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ABILITIES, ABILITY_LABEL, effectiveSpellKnownForCharacter, type Character } from "@/lib/character";

export function EditCharacterForm({ character }: { character: Character }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Character>(() => ({
    ...character,
    spells: { ...character.spells, known: effectiveSpellKnownForCharacter(character) },
  }));

  const equipmentText = useMemo(
    () =>
      draft.equipment
        .map((e) => (e.qty && e.qty > 1 ? `${e.qty}x ${e.name}` : e.name))
        .join("\n"),
    [draft.equipment]
  );
  const spellsText = useMemo(
    () =>
      draft.spells.known
        .map((s) => `${s.level}|${s.name}${s.prepared ? "|*" : ""}`)
        .join("\n"),
    [draft.spells.known]
  );
  const [equipmentRaw, setEquipmentRaw] = useState(equipmentText);
  const [spellsRaw, setSpellsRaw] = useState(spellsText);

  const patch = (p: Partial<Character>) => setDraft((prev) => ({ ...prev, ...p }));
  const patchAbility = (ab: keyof Character["abilities"], value: number) =>
    setDraft((prev) => ({ ...prev, abilities: { ...prev.abilities, [ab]: value } }));
  const patchHp = (p: Partial<Character["hp"]>) => setDraft((prev) => ({ ...prev, hp: { ...prev.hp, ...p } }));
  const patchMoney = (p: Partial<Character["money"]>) => setDraft((prev) => ({ ...prev, money: { ...prev.money, ...p } }));

  async function save() {
    setSaving(true);
    const equipment = parseEquipment(equipmentRaw);
    const knownSpells = parseSpells(spellsRaw);
    const payload: Partial<Character> = {
      name: draft.name,
      playerName: draft.playerName,
      level: draft.level,
      race: draft.race,
      class: draft.class,
      background: draft.background,
      abilities: draft.abilities,
      hp: draft.hp,
      ac: draft.ac,
      acOtherBonus: draft.acOtherBonus ?? 0,
      speed: draft.speed,
      initiativeBonus: draft.initiativeBonus,
      equipment,
      money: draft.money,
      notes: draft.notes,
      spells: { ...draft.spells, known: knownSpells },
    };
    try {
      await fetch(`/api/character/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      router.push(`/character/${draft.id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="card space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nombre">
            <input className="input mt-2" value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
          </Field>
          <Field label="Jugador (real)">
            <input
              className="input mt-2"
              value={draft.playerName ?? ""}
              onChange={(e) => patch({ playerName: e.target.value })}
            />
          </Field>
          <Field label="Nivel">
            <input
              type="number"
              className="input mt-2"
              min={1}
              max={20}
              value={draft.level}
              onChange={(e) => patch({ level: clampInt(e.target.value, 1, 20) })}
            />
          </Field>
          <Field label="Raza">
            <input className="input mt-2" value={draft.race} onChange={(e) => patch({ race: e.target.value })} />
          </Field>
          <Field label="Clase">
            <input className="input mt-2" value={draft.class} onChange={(e) => patch({ class: e.target.value })} />
          </Field>
          <Field label="Trasfondo">
            <input
              className="input mt-2"
              value={draft.background}
              onChange={(e) => patch({ background: e.target.value })}
            />
          </Field>
          <Field label="Velocidad">
            <input
              type="number"
              className="input mt-2"
              value={draft.speed}
              onChange={(e) => patch({ speed: clampInt(e.target.value, 0, 120) })}
            />
          </Field>
        </div>

        <div>
          <p className="label mb-2">Atributos</p>
          <div className="grid grid-cols-6 gap-2">
            {ABILITIES.map((a) => (
              <label key={a} className="block text-center">
                <span className="label">{ABILITY_LABEL[a]}</span>
                <input
                  type="number"
                  className="input mt-1 text-center"
                  value={draft.abilities[a]}
                  onChange={(e) => patchAbility(a, clampInt(e.target.value, 1, 30))}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Field label="HP máx.">
            <input
              type="number"
              className="input mt-2"
              value={draft.hp.max}
              onChange={(e) => patchHp({ max: clampInt(e.target.value, 1, 999) })}
            />
          </Field>
          <Field label="HP actual">
            <input
              type="number"
              className="input mt-2"
              value={draft.hp.current}
              onChange={(e) => patchHp({ current: clampInt(e.target.value, -50, 999) })}
            />
          </Field>
          <Field label="HP temp.">
            <input
              type="number"
              className="input mt-2"
              value={draft.hp.temp ?? 0}
              onChange={(e) => patchHp({ temp: clampInt(e.target.value, 0, 999) })}
            />
          </Field>
          <Field label="CA (total en juego)">
            <input
              type="number"
              className="input mt-2"
              value={draft.ac}
              onChange={(e) => patch({ ac: clampInt(e.target.value, 5, 30) })}
            />
          </Field>
          <Field
            label="Bonif. CA por objetos mágicos"
            hint="Sólo anotación PHB (anillo de protección, armadura +1, etc.). Súmalo mentalmente a la CA base o inclúyelo ya en el campo CA."
          >
            <input
              type="number"
              className="input mt-2"
              value={draft.acOtherBonus ?? 0}
              onChange={(e) => patch({ acOtherBonus: clampInt(e.target.value, -5, 10) })}
            />
          </Field>
        </div>

        <Field label="Notas">
          <textarea
            className="input mt-2"
            style={{ height: 120, padding: 10 }}
            value={draft.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div className="card space-y-4">
        <Field
          label="Inventario"
          hint="Uno por línea. Formato: &quot;3x Flecha&quot; para cantidad, o el nombre tal cual."
        >
          <textarea
            className="input mt-2"
            style={{ height: 160, padding: 10 }}
            value={equipmentRaw}
            onChange={(e) => setEquipmentRaw(e.target.value)}
          />
        </Field>

        <Field
          label="Conjuros conocidos"
          hint="Uno por línea: nivel|nombre|* si está preparado (nivel 0 = truco)."
        >
          <textarea
            className="input mt-2"
            style={{ height: 120, padding: 10 }}
            value={spellsRaw}
            onChange={(e) => setSpellsRaw(e.target.value)}
          />
        </Field>

        <div>
          <p className="label mb-2">Monedas</p>
          <div className="grid grid-cols-5 gap-2">
            {(["cp", "sp", "ep", "gp", "pp"] as const).map((k) => (
              <label key={k} className="block text-center">
                <span className="label uppercase">{k}</span>
                <input
                  type="number"
                  className="input mt-1 text-center"
                  value={draft.money[k]}
                  onChange={(e) => patchMoney({ [k]: clampInt(e.target.value, 0, 1_000_000) } as Record<typeof k, number>)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button className="btn-accent" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
          <button className="btn-ghost" onClick={() => router.back()} disabled={saving}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {hint && (
        <span className="mt-1 block text-[11px]" style={{ color: "var(--color-text-hint)" }}>
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function clampInt(raw: string, min: number, max: number) {
  const n = Math.round(Number(raw) || 0);
  return Math.max(min, Math.min(max, n));
}

function parseEquipment(raw: string): Character["equipment"] {
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s*[x×]\s*(.+)$/i);
      if (match) {
        return { name: match[2].trim(), qty: Math.max(1, Number(match[1])) };
      }
      return { name: line, qty: 1 };
    });
}

function parseSpells(raw: string): Character["spells"]["known"] {
  return raw
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|").map((p) => p.trim());
      const level = Math.max(0, Math.min(9, Number(parts[0]) || 0));
      const name = parts[1] ?? parts[0];
      const prepared = parts[2] === "*" || parts[2]?.toLowerCase() === "prepared";
      return { name, level, prepared };
    })
    .filter((s) => s.name);
}
