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
  type EquipmentItem,
  type RaceBasics,
} from "@/lib/character";

type Step = "race" | "class" | "background" | "abilities" | "skills" | "details" | "equipo" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "race", label: "Raza" },
  { id: "class", label: "Clase" },
  { id: "background", label: "Trasfondo" },
  { id: "abilities", label: "Atributos" },
  { id: "skills", label: "Habilidades" },
  { id: "details", label: "Detalles" },
  { id: "equipo", label: "Equipo" },
  { id: "review", label: "Revisión" },
];

type AbilityMethod = "standard" | "pointbuy" | "roll";
type MoneyMethod = "fixed" | "rolled";

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
  const [playerName, setPlayerName] = useState("");
  const [alignment, setAlignment] = useState("Neutral");
  const [level, setLevel] = useState(1);
  const [equipmentChoices, setEquipmentChoices] = useState<Record<string, string>>({});
  const [moneyMethod, setMoneyMethod] = useState<MoneyMethod>("fixed");
  const [rolledGold, setRolledGold] = useState<number | null>(null);
  const [goldRolls, setGoldRolls] = useState<number[]>([]);
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

  const equipmentChoiceComplete = useMemo(() => {
    if (!klass) return false;
    return klass.startingEquipmentChoices.every((c) => equipmentChoices[c.id]);
  }, [klass, equipmentChoices]);

  function buildEquipment(): EquipmentItem[] {
    if (!klass || !background) return [];
    const bgItems: EquipmentItem[] = background.equipment.map((n) => ({ name: n, qty: 1 }));
    if (moneyMethod === "rolled") return bgItems;
    const chosen: EquipmentItem[] = [];
    for (const choice of klass.startingEquipmentChoices) {
      const picked = equipmentChoices[choice.id];
      const opt = choice.options.find((o) => o.id === picked);
      if (opt) chosen.push(...opt.items);
    }
    return [...klass.startingEquipmentFixed, ...chosen, ...bgItems];
  }

  function buildMoney() {
    const money = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
    if (background) money.gp += background.startingMoney.gp ?? 0;
    if (moneyMethod === "rolled" && rolledGold != null) money.gp += rolledGold;
    return money;
  }

  async function save() {
    if (!race || !klass || !background || !name) return;
    setSaving(true);
    const equipment = buildEquipment();
    const money = buildMoney();
    const payload = {
      name,
      playerName: playerName || undefined,
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
        tools: [...(klass.toolProficiencies ?? []), ...background.tools],
        languages: race.languages,
      },
      equipment,
      money,
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

  function goNext() {
    const next = STEPS[Math.min(STEPS.length - 1, stepIdx + 1)];
    setStep(next.id);
  }
  function goPrev() {
    const prev = STEPS[Math.max(0, stepIdx - 1)];
    setStep(prev.id);
  }

  const nextDisabled = ((): boolean => {
    if (step === "race") return !race;
    if (step === "class") return !klass;
    if (step === "background") return !background;
    if (step === "skills" && klass) {
      const bgSet = new Set(background?.skillProficiencies ?? []);
      const classSkills = skills.filter((s) => !bgSet.has(s));
      return classSkills.length !== klass.skillChoices.count;
    }
    if (step === "equipo") {
      if (moneyMethod === "fixed") return !equipmentChoiceComplete;
      return rolledGold == null;
    }
    if (step === "details") return !name.trim();
    return false;
  })();

  return (
    <div>
      <Stepper steps={STEPS} current={stepIdx} onGo={(s) => setStep(s.id)} />
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="stagger">
          {step === "race" && <RaceStep race={race} onPick={setRace} />}
          {step === "class" && <ClassStep klass={klass} onPick={setKlass} />}
          {step === "background" && <BackgroundStep bg={background} onPick={setBackground} />}
          {step === "abilities" && (
            <AbilitiesStep
              method={method}
              setMethod={setMethod}
              abilities={abilities}
              setAbilities={setAbilities}
              rolled={rolledScores}
              setRolled={setRolledScores}
              race={race}
            />
          )}
          {step === "skills" && (
            <SkillsStep klass={klass} bg={background} skills={skills} setSkills={setSkills} />
          )}
          {step === "details" && (
            <DetailsStep
              name={name}
              setName={setName}
              playerName={playerName}
              setPlayerName={setPlayerName}
              alignment={alignment}
              setAlignment={setAlignment}
              level={level}
              setLevel={setLevel}
            />
          )}
          {step === "equipo" && (
            <EquipmentStep
              klass={klass}
              background={background}
              equipmentChoices={equipmentChoices}
              setEquipmentChoices={setEquipmentChoices}
              moneyMethod={moneyMethod}
              setMoneyMethod={setMoneyMethod}
              rolledGold={rolledGold}
              setRolledGold={setRolledGold}
              goldRolls={goldRolls}
              setGoldRolls={setGoldRolls}
            />
          )}
          {step === "review" && (
            <ReviewStep
              race={race}
              klass={klass}
              background={background}
              abilities={effective}
              name={name}
              playerName={playerName}
              level={level}
              alignment={alignment}
              maxHp={maxHp}
              ac={ac}
              prof={prof}
              equipment={buildEquipment()}
              money={buildMoney()}
              skills={skills}
            />
          )}

          <div className="mt-10 flex items-center justify-between">
            <button className="btn-ghost" disabled={stepIdx === 0} onClick={goPrev}>
              ← Anterior
            </button>
            {step !== "review" ? (
              <button
                className="btn-accent"
                disabled={nextDisabled}
                onClick={goNext}
                title={nextDisabled ? "Completa este paso para continuar" : undefined}
              >
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
              {playerName && (
                <>
                  <dt style={{ color: "var(--color-text-hint)" }}>Jugador</dt>
                  <dd>{playerName}</dd>
                </>
              )}
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

function Stepper({
  steps,
  current,
  onGo,
}: {
  steps: { id: Step; label: string }[];
  current: number;
  onGo: (s: { id: Step; label: string }) => void;
}) {
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
            Vel. {r.speed} ·{" "}
            {Object.entries(r.abilityBonus)
              .map(([k, v]) => `${k.toUpperCase()} +${v}`)
              .join(", ")}
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
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {c.skillChoices.count} habilidades a elegir · Oro inicial {c.startingGoldDice.dice}d{c.startingGoldDice.faces}
            {c.startingGoldDice.multiplier > 1 ? `×${c.startingGoldDice.multiplier}` : ""}
          </p>
          {c.spellcasting && (
            <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>
              Conjuros ({c.spellcasting.caster}) · {ABILITY_LABEL[c.spellcasting.ability]}
            </p>
          )}
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
            Habilidades: {b.skillProficiencies.map((s) => SKILLS[s]?.label ?? s).join(", ")} · {b.startingMoney.gp} po
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
    setAbilities({ fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 });
  }

  function poolFor(source: "standard" | "roll"): number[] {
    return source === "standard" ? [...STANDARD_ARRAY] : [...rolled];
  }

  function availableForAbility(source: "standard" | "roll", current: number): number[] {
    const pool = poolFor(source);
    const used: Record<number, number> = {};
    for (const a of ABILITIES) {
      const v = abilities[a];
      if (!v) continue;
      used[v] = (used[v] ?? 0) + 1;
    }
    const capacity: Record<number, number> = {};
    for (const v of pool) capacity[v] = (capacity[v] ?? 0) + 1;
    const seen = new Set<number>();
    const result: number[] = [];
    for (const v of pool) {
      if (seen.has(v)) continue;
      seen.add(v);
      const remaining = (capacity[v] ?? 0) - (used[v] ?? 0);
      if (remaining > 0 || v === current) result.push(v);
    }
    return result.sort((a, b) => b - a);
  }

  function assignAbility(ability: Ability, raw: string) {
    const v = raw === "" ? 0 : Number(raw);
    setAbilities({ ...abilities, [ability]: v });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {(["standard", "pointbuy", "roll"] as AbilityMethod[]).map((m) => (
          <button key={m} onClick={() => setMethod(m)} className={method === m ? "btn-accent" : "btn-ghost"}>
            {m === "standard" ? "Array estándar" : m === "pointbuy" ? "Point buy" : "Tirada de dados"}
          </button>
        ))}
      </div>

      {method === "standard" && (
        <div>
          <p className="mb-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            Asigna los valores {STANDARD_ARRAY.join(", ")} a cada atributo. Un valor que ya hayas usado desaparece de las demás listas
            hasta que lo liberes eligiendo "—".
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map((a) => {
              const values = availableForAbility("standard", abilities[a]);
              return (
                <label key={a} className="card block">
                  <span className="label uppercase">{a}</span>
                  <select
                    className="input mt-2"
                    value={abilities[a] || ""}
                    onChange={(e) => assignAbility(a, e.target.value)}
                  >
                    <option value="">—</option>
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v} ({formatMod(abilityMod(v + (race?.abilityBonus?.[a] ?? 0)))})
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
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
                  <button
                    className="btn-ghost px-3"
                    onClick={() => setAbilities({ ...abilities, [a]: Math.max(8, abilities[a] - 1) })}
                  >
                    −
                  </button>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>{abilities[a]}</span>
                  <button
                    className="btn-ghost px-3"
                    onClick={() => setAbilities({ ...abilities, [a]: Math.min(15, abilities[a] + 1) })}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {method === "roll" && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button className="btn-accent" onClick={rollManual}>
              {rolled.length ? "Volver a tirar" : "Tirar 4d6 (descartar menor) × 6"}
            </button>
            <span className="text-sm" style={{ color: "var(--color-text-hint)" }}>
              {rolled.length
                ? `Tiradas: ${[...rolled].sort((a, b) => b - a).join(", ")}`
                : "Sin tiradas aún"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ABILITIES.map((a) => {
              const values = availableForAbility("roll", abilities[a]);
              return (
                <label key={a} className="card block">
                  <span className="label uppercase">{a}</span>
                  <select
                    className="input mt-2"
                    value={abilities[a] || ""}
                    onChange={(e) => assignAbility(a, e.target.value)}
                    disabled={!rolled.length}
                  >
                    <option value="">—</option>
                    {values.map((v) => (
                      <option key={v} value={v}>
                        {v} ({formatMod(abilityMod(v + (race?.abilityBonus?.[a] ?? 0)))})
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
          {rolled.length > 0 && (
            <p className="mt-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
              Cada valor rola solo una vez salvo que salgan duplicados en las tiradas. Pon un atributo en "—" para volver a usar su valor.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SkillsStep({
  klass,
  bg,
  skills,
  setSkills,
}: {
  klass: ClassBasics | null;
  bg: BackgroundBasics | null;
  skills: string[];
  setSkills: (s: string[]) => void;
}) {
  const bgSkills = new Set(bg?.skillProficiencies ?? []);
  const classList = new Set(klass?.skillChoices.from ?? []);
  const picked = new Set(skills);
  const classPicks = skills.filter((s) => !bgSkills.has(s));
  const limit = klass?.skillChoices.count ?? 0;
  const remaining = Math.max(0, limit - classPicks.length);

  const toggle = (key: string) => {
    if (bgSkills.has(key)) return;
    if (!classList.has(key)) return;
    const next = new Set(picked);
    if (next.has(key)) next.delete(key);
    else {
      if (classPicks.length >= limit) return;
      next.add(key);
    }
    setSkills(Array.from(next));
  };

  if (!klass || !bg) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
        Selecciona clase y trasfondo antes de elegir habilidades.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          Tu trasfondo cubre {bg.skillProficiencies.length} habilidades. Elige {limit} habilidades de la lista de {klass.label}.
        </p>
        <span className="badge" style={{ color: remaining === 0 ? "var(--color-accent)" : undefined }}>
          {classPicks.length}/{limit}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {Object.entries(SKILLS).map(([key, s]) => {
          const fromBg = bgSkills.has(key);
          const inClass = classList.has(key);
          const checked = fromBg || picked.has(key);
          const disabled = fromBg || !inClass || (!checked && remaining === 0);
          const label = fromBg ? "trasfondo" : inClass ? "clase" : "no disponible";
          const color = fromBg
            ? "var(--color-accent)"
            : inClass
              ? "var(--color-text-secondary)"
              : "var(--color-text-hint)";
          return (
            <label
              key={key}
              className="card flex items-center justify-between py-3"
              style={{ opacity: !inClass && !fromBg ? 0.55 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
            >
              <div>
                <p className="text-sm">{s.label}</p>
                <p className="text-xs" style={{ color }}>
                  {ABILITY_LABEL[s.ability]} · {label}
                </p>
              </div>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggle(key)} />
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
  playerName,
  setPlayerName,
  alignment,
  setAlignment,
  level,
  setLevel,
}: {
  name: string;
  setName: (v: string) => void;
  playerName: string;
  setPlayerName: (v: string) => void;
  alignment: string;
  setAlignment: (v: string) => void;
  level: number;
  setLevel: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="block">
        <span className="label">Nombre del personaje</span>
        <input className="input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Arannis Soldrake" />
      </label>
      <label className="block">
        <span className="label">Nombre del jugador (real)</span>
        <input
          className="input mt-2"
          value={playerName}
          onChange={(e) => setPlayerName(e.target.value)}
          placeholder="Ej: María López"
        />
      </label>
      <label className="block">
        <span className="label">Nivel</span>
        <input className="input mt-2" type="number" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
      </label>
      <label className="block">
        <span className="label">Alineamiento</span>
        <select className="input mt-2" value={alignment} onChange={(e) => setAlignment(e.target.value)}>
          {[
            "Legal bueno",
            "Neutral bueno",
            "Caótico bueno",
            "Legal neutral",
            "Neutral",
            "Caótico neutral",
            "Legal malvado",
            "Neutral malvado",
            "Caótico malvado",
          ].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function EquipmentStep({
  klass,
  background,
  equipmentChoices,
  setEquipmentChoices,
  moneyMethod,
  setMoneyMethod,
  rolledGold,
  setRolledGold,
  goldRolls,
  setGoldRolls,
}: {
  klass: ClassBasics | null;
  background: BackgroundBasics | null;
  equipmentChoices: Record<string, string>;
  setEquipmentChoices: (v: Record<string, string>) => void;
  moneyMethod: MoneyMethod;
  setMoneyMethod: (m: MoneyMethod) => void;
  rolledGold: number | null;
  setRolledGold: (v: number | null) => void;
  goldRolls: number[];
  setGoldRolls: (r: number[]) => void;
}) {
  if (!klass || !background) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
        Selecciona clase y trasfondo antes de configurar el equipo.
      </p>
    );
  }

  function rollGold() {
    if (!klass) return;
    const { dice, faces, multiplier } = klass.startingGoldDice;
    const rolls = Array.from({ length: dice }, () => Math.floor(Math.random() * faces) + 1);
    const total = rolls.reduce((acc, v) => acc + v, 0) * multiplier;
    setGoldRolls(rolls);
    setRolledGold(total);
  }

  const goldExpr = `${klass.startingGoldDice.dice}d${klass.startingGoldDice.faces}${klass.startingGoldDice.multiplier > 1 ? `×${klass.startingGoldDice.multiplier}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          className={moneyMethod === "fixed" ? "btn-accent" : "btn-ghost"}
          onClick={() => setMoneyMethod("fixed")}
        >
          Tomar equipo de clase
        </button>
        <button
          className={moneyMethod === "rolled" ? "btn-accent" : "btn-ghost"}
          onClick={() => setMoneyMethod("rolled")}
        >
          Tirar dinero inicial ({goldExpr} po)
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
        {moneyMethod === "fixed"
          ? `Llevas el paquete estándar de tu clase + los objetos del trasfondo ${background.label}.`
          : `Rolas tu oro inicial y vas a comprar el equipo por tu cuenta. Sólo conservas el equipo del trasfondo ${background.label}.`}
      </p>

      {moneyMethod === "fixed" && (
        <div className="space-y-4">
          {klass.startingEquipmentFixed.length > 0 && (
            <div className="card">
              <p className="label mb-2">Equipo inicial garantizado</p>
              <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
                {klass.startingEquipmentFixed.map((it, i) => (
                  <li key={i}>
                    {it.qty > 1 ? `${it.qty}× ` : ""}
                    {it.name}
                    {it.note && (
                      <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        · {it.note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {klass.startingEquipmentChoices.map((choice) => (
            <div key={choice.id} className="card">
              <p className="label mb-2">{choice.label}</p>
              <div className="grid grid-cols-1 gap-2">
                {choice.options.map((opt) => {
                  const picked = equipmentChoices[choice.id] === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setEquipmentChoices({ ...equipmentChoices, [choice.id]: opt.id })}
                      className={picked ? "card-accent text-left" : "card text-left"}
                      style={{ padding: "12px 14px" }}
                    >
                      <p className="text-sm">{opt.label}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        {opt.items
                          .slice(0, 6)
                          .map((it) => (it.qty > 1 ? `${it.qty}× ${it.name}` : it.name))
                          .join(", ")}
                        {opt.items.length > 6 ? "…" : ""}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {moneyMethod === "rolled" && (
        <div className="card">
          <p className="label mb-2">Tirada de oro inicial ({goldExpr})</p>
          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-accent" onClick={rollGold}>
              {rolledGold == null ? "Tirar dados" : "Volver a tirar"}
            </button>
            {rolledGold != null && (
              <div>
                <p className="text-sm">
                  <strong>{rolledGold} po</strong>
                </p>
                <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                  Tiradas: [{goldRolls.join(", ")}]
                  {klass.startingGoldDice.multiplier > 1 ? ` × ${klass.startingGoldDice.multiplier}` : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card">
        <p className="label mb-2">Equipo del trasfondo ({background.label})</p>
        <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          {background.equipment.map((name, i) => (
            <li key={i}>{name}</li>
          ))}
          <li>
            <span style={{ color: "var(--color-accent)" }}>{background.startingMoney.gp} po</span> iniciales del trasfondo
          </li>
        </ul>
      </div>
    </div>
  );
}

function ReviewStep({
  race,
  klass,
  background,
  abilities,
  name,
  playerName,
  level,
  alignment,
  maxHp,
  ac,
  prof,
  equipment,
  money,
  skills,
}: {
  race: RaceBasics | null;
  klass: ClassBasics | null;
  background: BackgroundBasics | null;
  abilities: Record<Ability, number>;
  name: string;
  playerName: string;
  level: number;
  alignment: string;
  maxHp: number;
  ac: number;
  prof: number;
  equipment: EquipmentItem[];
  money: { cp: number; sp: number; ep: number; gp: number; pp: number };
  skills: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-1">{name || "Sin nombre"}</h2>
        {playerName && (
          <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
            Jugador: {playerName}
          </p>
        )}
        <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
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

      <div className="card">
        <p className="label mb-2">Habilidades con competencia</p>
        <p className="text-sm">
          {skills.length ? skills.map((k) => SKILLS[k]?.label ?? k).join(", ") : "Ninguna"}
        </p>
      </div>

      <div className="card">
        <p className="label mb-2">Equipo</p>
        {equipment.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>Sin objetos.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            {equipment.map((it, i) => (
              <li key={i}>
                {it.qty > 1 ? `${it.qty}× ` : ""}
                {it.name}
                {it.note && (
                  <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                    · {it.note}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <strong>Oro inicial:</strong> {money.gp} po
        </p>
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
