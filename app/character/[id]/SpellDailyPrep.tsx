"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  CLASSES,
  type Character,
  effectiveAbility,
  effectiveSpellKnownForCharacter,
  nonCantripSpellPicks,
  type Ability,
} from "@/lib/character";

type Props = { character: Character };

function withEffectiveKnown(c: Character): Character {
  return { ...c, spells: { ...c.spells, known: effectiveSpellKnownForCharacter(c) } };
}

/** PHB: lanzadores con conjuros preparados pueden cambiar el subconjunto tras un descanso largo. */
export function SpellDailyPrep({ character: initial }: Props) {
  const router = useRouter();
  const [char, setChar] = useState<Character>(() => withEffectiveKnown(initial));
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setChar(withEffectiveKnown(initial));
  }, [initial]);

  useEffect(() => {
    const expanded = effectiveSpellKnownForCharacter(initial);
    if (expanded.length <= initial.spells.known.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/character/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spells: { ...initial.spells, known: expanded } }),
        });
        if (!cancelled && res.ok) router.refresh();
      } catch {
        /* ignorar; la UI ya muestra la lista fusionada */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initial.id, initial.class, initial.level, initial.spells.known.length, router]);

  const meta = useMemo(() => {
    const klass = CLASSES.find((c) => c.id === char.class);
    const sc = klass?.spellcasting;
    if (!klass || !sc || sc.preparation !== "prepared") return null;
    const ability = (char.spells.ability ?? sc.ability) as Ability;
    const score = effectiveAbility(char, ability);
    const maxPrepared = nonCantripSpellPicks(sc, klass.id, char.level, score);
    return { maxPrepared };
  }, [char]);

  if (!meta) return null;

  const { maxPrepared } = meta;

  async function togglePrepared(idx: number) {
    setErr(null);
    const snapshot = char;
    const row = snapshot.spells.known[idx];
    if (!row || row.level < 1) return;
    const willPrepare = !row.prepared;
    const preparedCount = snapshot.spells.known.filter((s) => s.level >= 1 && s.prepared).length;
    if (willPrepare && preparedCount >= maxPrepared) {
      setErr(`Sólo puedes tener ${maxPrepared} conjuros de nivel ≥1 preparados (PHB).`);
      return;
    }
    const known = snapshot.spells.known.map((s, i) => (i === idx ? { ...s, prepared: willPrepare } : s));
    const nextSpells = { ...snapshot.spells, known };
    setChar({ ...snapshot, spells: nextSpells });
    try {
      const res = await fetch(`/api/character/${snapshot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spells: nextSpells }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      router.refresh();
    } catch {
      setChar(snapshot);
      setErr("Error al guardar. Inténtalo de nuevo.");
    }
  }

  const leveledRows = char.spells.known
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => s.level >= 1);

  if (leveledRows.length === 0) return null;

  return (
    <div className="mb-4 rounded-md p-3" style={{ background: "var(--color-bg-tertiary)", border: "0.5px solid var(--color-border)" }}>
      <p className="label mb-1">Preparación diaria</p>
      <p className="mb-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
        Tras un descanso largo (PHB), elige hasta {maxPrepared} conjuros de nivel ≥1 preparados entre tu repertorio de clase. Los trucos no cuentan.{" "}
        Ahora: {char.spells.known.filter((s) => s.level >= 1 && s.prepared).length}/{maxPrepared}.
      </p>
      {maxPrepared === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Aún no tienes ranuras de conjuro de nivel 1+.
        </p>
      ) : (
        <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">
          {leveledRows.map(({ s, idx }) => (
            <li key={`${idx}-${s.name}`} className="flex items-center justify-between gap-2">
              <span>
                <span style={{ color: "var(--color-accent)" }}>Nv {s.level}</span> · {s.name}
              </span>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <input type="checkbox" checked={s.prepared} onChange={() => void togglePrepared(idx)} />
                Preparado
              </label>
            </li>
          ))}
        </ul>
      )}
      {err && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>
          {err}
        </p>
      )}
    </div>
  );
}
