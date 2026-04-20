"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ABILITIES,
  ABILITY_LABEL,
  BACKGROUNDS,
  CLASSES,
  RACES,
  SKILLS,
  STANDARD_ARRAY,
  abilityMod,
  maxHpAtLevel1,
  pointBuyTotal,
  proficiencyBonus,
  spellSlotsFor,
  type Ability,
  type BackgroundBasics,
  type ClassBasics,
  type RaceBasics,
} from "@/lib/character";

type Step = "race" | "class" | "background" | "abilities" | "skills" | "details" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "race", label: "Raza" },
  { id: "class", label: "Clase" },
  { id: "background", label: "Trasfondo" },
  { id: "abilities", label: "Atributos" },
  { id: "skills", label: "Habilidades" },
  { id: "details", label: "Detalles" },
  { id: "review", label: "Revisión" },
];

type AbilityMethod = "standard" | "pointbuy" | "roll";

const ZEROES: Record<Ability, number> = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };

export function CharacterWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("race");
  const [race, setRace] = useState<RaceBasics | null>(null);
  const [klass, setKlass] = useState<ClassBasics | null>(null);
  const [background, setBackground] = useState<BackgroundBasics | null>(null);
  const [method, setMethod] = useState<AbilityMethod>("standard");
  const [abilities, setAbilities] = useState<Record<Ability, number>>({ fue: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 });
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [alignment, setAlignment] = useState("Neutral");
  const [level, setLevel] = useState(1);
  const [saving, setSaving] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  const effective = useMemo(() => {
    const e: Record<Ability, number> = { ...abilities };
    if (race) for (const [k, v] of Object.entries(race.abilityBonus)) e[k as Ability] += v ?? 0;
    return e;
  }, [abilities, race]);

  const conMod = abilityMod(effective.con);
  const maxHp = klass ? maxHpAtLevel1(klass.hitDie, conMod) : 0;
  const ac = 10 + abilityMod(effective.des);
  const prof = proficiencyBonus(level);

  async function save() {
    if (!race || !klass || !background || !name) return;
    setSaving(true);
    const payload = {
      name,
      level,
      race: race.id,
      class: klass.id,
      background: background.id,
      alignment,
      abilities,
      abilityRacialBonus: race.abilityBonus,
      skills,
      savingThrows: klass.savingThrows,
      hp: { max: maxHp, current: maxHp, temp: 0, hitDie: klass.hitDie },
      ac,
      speed: race.speed,
      initiativeBonus: 0,
      proficiencies: {
        armor: klass.armorProficiencies,
        weapons: klass.weaponProficiencies,
        tools: background.tools,
        languages: race.languages,
      },
      equipment: background.equipment.map((name) => ({ name, qty: 1 })),
      money: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
      spells: klass.spellcasting
        ? {
            ability: klass.spellcasting.ability,
            known: [],
            slots: Object.fromEntries(spellSlotsFor(klass.spellcasting.caster, level).map((n, i) => [String(i + 1), { max: n, used: 0 }])),
          }
        : { known: [], slots: {} },
      features: [{ name: background.feature.name, source: background.label, text: background.feature.text }],
    };
    const res = await fetch("/api/character", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await res.json()) as { id: string };
    router.push(`/character/${data.id}`);
  }

  return (
    <div>
      <Stepper steps={STEPS} current={stepIdx} onGo={(s) => setStep(s.id)} />
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="stagger">
          {step === "race" && <RaceStep race={race} onPick={setRace} />}
          {step === "class" && <ClassStep klass={klass} onPick={setKlass} />}
          {step === "background" && <BackgroundStep bg={background} onPick={setBackground} />}
          {step === "abilities" && (
            <AbilitiesStep method={method} setMethod={setMethod} abilities={abilities} setAbilities={setAbilities} rolled={rolledScores} setRolled={setRolledScores} race={race} />
          )}
          {step === "skills" && <SkillsStep klass={klass} bg={background} skills={skills} setSkills={setSkills} />}
          {step === "details" && <DetailsStep name={name} setName={setName} alignment={alignment} setAlignment={setAlignment} level={level} setLevel={setLevel} />}
          {step === "review" && <ReviewStep race={race} klass={klass} background={background} abilities={effective} name={name} level={level} alignment={alignment} maxHp={maxHp} ac={ac} prof={prof} />}

          <div className="mt-10 flex items-center justify-between">
            <button className="btn-ghost" disabled={stepIdx === 0} onClick={() => setStep(STEPS[Math.max(0, stepIdx - 1)].id)}>
              ← Anterior
            </button>
            {step !== "review" ? (
              <button className="btn-accent" onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIdx + 1)].id)}>
                Siguiente →
              </button>
            ) : (
              <button className="btn-accent" disabled={saving || !name || !race || !klass || !background} onClick={save}>
                {saving ? "Guardando…" : "Guardar personaje"}
              </button>
            )}
          </div>
        </div>

        <aside className="relative">
          <div className="sticky top-24 card">
            <p className="label mb-2">Resumen</p>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt style={{ color: "var(--color-text-hint)" }}>Nombre</dt>
              <dd>{name || "—"}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>Raza</dt>
              <dd>{race?.label ?? "—"}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>Clase</dt>
              <dd>{klass?.label ?? "—"}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>Trasfondo</dt>
              <dd>{background?.label ?? "—"}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>Nivel</dt>
              <dd>{level}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>HP máx.</dt>
              <dd>{maxHp || "—"}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>CA</dt>
              <dd>{ac}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>Comp.</dt>
              <dd>+{prof}</dd>
            </dl>
            <div className="my-4 divider" />
            <div className="grid grid-cols-3 gap-2">
              {ABILITIES.map((a) => (
                <div key={a} className="rounded-md px-2 py-2 text-center" style={{ background: "var(--color-bg-tertiary)" }}>
                  <p className="label uppercase" style={{ fontSize: 10 }}>
                    {a}
                  </p>
                  <p style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{effective[a]}</p>
                  <p style={{ color: "var(--color-text-hint)", fontSize: 11 }}>{formatMod(abilityMod(effective[a]))}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ steps, current, onGo }: { steps: { id: Step; label: string }[]; current: number; onGo: (s: { id: Step; label: string }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <button
            key={s.id}
            onClick={() => onGo(s)}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs transition"
            style={{
              color: active ? "var(--color-accent)" : done ? "var(--color-text-primary)" : "var(--color-text-hint)",
              background: active ? "var(--color-accent-bg)" : "transparent",
              border: "0.5px solid var(--color-border)",
            }}
          >
            <span style={{ fontFamily: "var(--font-display)" }}>{i + 1}</span>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function RaceStep({ race, onPick }: { race: RaceBasics | null; onPick: (r: RaceBasics) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {RACES.map((r) => (
        <button key={r.id} onClick={() => onPick(r)} className={r.id === race?.id ? "card-accent text-left" : "card text-left"}>
          <h3 className="mb-1">{r.label}</h3>
          <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
            Vel. {r.speed} · {Object.entries(r.abilityBonus).map(([k, v]) => `${k.toUpperCase()} +${v}`).join(", ")}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {r.traits.join(" · ")}
          </p>
        </button>
      ))}
    </div>
  );
}

function ClassStep({ klass, onPick }: { klass: ClassBasics | null; onPick: (c: ClassBasics) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {CLASSES.map((c) => (
        <button key={c.id} onClick={() => onPick(c)} className={c.id === klass?.id ? "card-accent text-left" : "card text-left"}>
          <div className="flex items-center justify-between">
            <h3>{c.label}</h3>
            <span className="badge">d{c.hitDie}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
            Principal: {c.primaryAbility.map((a) => ABILITY_LABEL[a]).join("/")} · Salv: {c.savingThrows.map((a) => ABILITY_LABEL[a]).join(", ")}
          </p>
          {c.spellcasting && <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>Conjuros ({c.spellcasting.caster}) · {ABILITY_LABEL[c.spellcasting.ability]}</p>}
        </button>
      ))}
    </div>
  );
}

function BackgroundStep({ bg, onPick }: { bg: BackgroundBasics | null; onPick: (b: BackgroundBasics) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {BACKGROUNDS.map((b) => (
        <button key={b.id} onClick={() => onPick(b)} className={b.id === bg?.id ? "card-accent text-left" : "card text-left"}>
          <h3>{b.label}</h3>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
            Habilidades: {b.skillProficiencies.map((s) => SKILLS[s]?.label ?? s).join(", ")}
          </p>
          <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            <strong>{b.feature.name}</strong>: {b.feature.text}
          </p>
        </button>
      ))}
    </div>
  );
}

function AbilitiesStep({
  method,
  setMethod,
  abilities,
  setAbilities,
  rolled,
  setRolled,
  race,
}: {
  method: AbilityMethod;
  setMethod: (m: AbilityMethod) => void;
  abilities: Record<Ability, number>;
  setAbilities: (a: Record<Ability, number>) => void;
  rolled: number[];
  setRolled: (r: number[]) => void;
  race: RaceBasics | null;
}) {
  const pbTotal = pointBuyTotal(abilities);

  function rollManual() {
    const results = Array.from({ length: 6 }, () => {
      const d = [1, 2, 3, 4].map(() => Math.floor(Math.random() * 6) + 1).sort((a, b) => b - a);
      return d[0] + d[1] + d[2];
    });
    setRolled(results);
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(["standard", "pointbuy", "roll"] as AbilityMethod[]).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={method === m ? "btn-accent" : "btn-ghost"}>
            {m === "standard" ? "Array estándar" : m === "pointbuy" ? "Point buy" : "Tirada de dados"}
          </button>
        ))}
      </div>

      {method === "standard" && (
        <div>
          <p className="mb-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Asigna los valores {STANDARD_ARRAY.join(", ")} a cada atributo.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map((a) => (
              <label key={a} className="card block">
                <span className="label uppercase">{a}</span>
                <select className="input mt-2" value={abilities[a] || ""} onChange={(e) => setAbilities({ ...abilities, [a]: Number(e.target.value) })}>
                  <option value="">—</option>
                  {STANDARD_ARRAY.map((v) => (
                    <option key={v} value={v}>
                      {v} ({formatMod(abilityMod(v + (race?.abilityBonus?.[a] ?? 0)))})
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {method === "pointbuy" && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Tienes 27 puntos. Rango 8–15 antes de bonos raciales.
            </p>
            <span className="badge">Gastados: {pbTotal}/27</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map((a) => (
              <div key={a} className="card">
                <span className="label uppercase">{a}</span>
                <div className="mt-2 flex items-center justify-between">
                  <button className="btn-ghost px-3" onClick={() => setAbilities({ ...abilities, [a]: Math.max(8, abilities[a] - 1) })}>−</button>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{abilities[a]}</span>
                  <button className="btn-ghost px-3" onClick={() => setAbilities({ ...abilities, [a]: Math.min(15, abilities[a] + 1) })}>+</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {method === "roll" && (
        <div>
          <div className="mb-3 flex items-center gap-3">
            <button className="btn-accent" onClick={rollManual}>Tirar 4d6 (descartar menor) × 6</button>
            <span className="text-sm" style={{ color: "var(--color-text-hint)" }}>{rolled.length ? rolled.join(", ") : "Sin tiradas aún"}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map((a) => (
              <label key={a} className="card block">
                <span className="label uppercase">{a}</span>
                <select className="input mt-2" value={abilities[a] || ""} onChange={(e) => setAbilities({ ...abilities, [a]: Number(e.target.value) })}>
                  <option value="">—</option>
                  {rolled.map((v, i) => (
                    <option key={i} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SkillsStep({ klass, bg, skills, setSkills }: { klass: ClassBasics | null; bg: BackgroundBasics | null; skills: string[]; setSkills: (s: string[]) => void }) {
  const bgSkills = bg?.skillProficiencies ?? [];
  const picked = new Set(skills);
  const toggle = (key: string) => {
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSkills(Array.from(next));
  };
  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        Las habilidades del trasfondo están pre-seleccionadas. Elige el resto según tu clase.
      </p>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {Object.entries(SKILLS).map(([key, s]) => {
          const fromBg = bgSkills.includes(key);
          const checked = fromBg || picked.has(key);
          return (
            <label key={key} className="flex items-center justify-between card py-3">
              <div>
                <p className="text-sm">{s.label}</p>
                <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                  {ABILITY_LABEL[s.ability]}
                </p>
              </div>
              <input type="checkbox" checked={checked} disabled={fromBg} onChange={() => toggle(key)} />
            </label>
          );
        })}
      </div>
    </div>
  );
}

function DetailsStep({
  name,
  setName,
  alignment,
  setAlignment,
  level,
  setLevel,
}: {
  name: string;
  setName: (v: string) => void;
  alignment: string;
  setAlignment: (v: string) => void;
  level: number;
  setLevel: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block">
        <span className="label">Nombre</span>
        <input className="input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Arannis Soldrake" />
      </label>
      <label className="block">
        <span className="label">Nivel</span>
        <input className="input mt-2" type="number" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
      </label>
      <label className="block md:col-span-2">
        <span className="label">Alineamiento</span>
        <select className="input mt-2" value={alignment} onChange={(e) => setAlignment(e.target.value)}>
          {["Legal bueno", "Neutral bueno", "Caótico bueno", "Legal neutral", "Neutral", "Caótico neutral", "Legal malvado", "Neutral malvado", "Caótico malvado"].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function ReviewStep({ race, klass, background, abilities, name, level, alignment, maxHp, ac, prof }: { race: RaceBasics | null; klass: ClassBasics | null; background: BackgroundBasics | null; abilities: Record<Ability, number>; name: string; level: number; alignment: string; maxHp: number; ac: number; prof: number }) {
  return (
    <div className="card">
      <h2 className="mb-4">{name || "Sin nombre"}</h2>
      <p style={{ color: "var(--color-text-secondary)" }}>
        {race?.label ?? "?"} {klass?.label ?? "?"} nivel {level} · {alignment} · Trasfondo: {background?.label ?? "?"}
      </p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="HP máximo" value={maxHp} />
        <Stat label="CA" value={ac} />
        <Stat label="Competencia" value={`+${prof}`} />
      </div>
      <div className="mt-5 grid grid-cols-6 gap-2">
        {ABILITIES.map((a) => (
          <div key={a} className="rounded-md p-2 text-center" style={{ background: "var(--color-bg-tertiary)" }}>
            <p className="label uppercase">{a}</p>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{abilities[a]}</p>
            <p style={{ color: "var(--color-text-hint)", fontSize: 11 }}>{formatMod(abilityMod(abilities[a]))}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md p-3 text-center" style={{ background: "var(--color-bg-tertiary)" }}>
      <p className="label">{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 26 }}>{value}</p>
    </div>
  );
}

function formatMod(n: number) {
  return n >= 0 ? `+${n}` : String(n);
}
