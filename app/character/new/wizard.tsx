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
  STANDARD_LANGUAGES,
  abilityMod,
  computeAc,
  firstLevelSpellPicks,
  maxHpAtLevel1,
  pointBuyTotal,
  proficiencyBonus,
  spellSlotsFor,
  type Ability,
  type BackgroundBasics,
  type ClassBasics,
  type EquipmentItem,
  type RaceBasics,
  type RaceVariant,
} from "@/lib/character";
import { SPELLS, spellsForClassAtLevel, type Spell, type SpellClassId } from "@/lib/spells";

type Step = "race" | "class" | "background" | "abilities" | "skills" | "spells" | "details" | "equipo" | "review";

const STEPS: { id: Step; label: string }[] = [
  { id: "race", label: "Raza" },
  { id: "class", label: "Clase" },
  { id: "background", label: "Trasfondo" },
  { id: "abilities", label: "Atributos" },
  { id: "skills", label: "Habilidades" },
  { id: "spells", label: "Conjuros" },
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
  const [variantId, setVariantId] = useState<string>("");
  const [halfElfBonus, setHalfElfBonus] = useState<Ability[]>([]);
  const [klass, setKlass] = useState<ClassBasics | null>(null);
  const [background, setBackground] = useState<BackgroundBasics | null>(null);
  const [method, setMethod] = useState<AbilityMethod>("standard");
  const [abilities, setAbilities] = useState<Record<Ability, number>>({ fue: 8, des: 8, con: 8, int: 8, sab: 8, car: 8 });
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [skills, setSkills] = useState<string[]>([]);
  const [bonusSkills, setBonusSkills] = useState<string[]>([]);
  const [chosenLanguages, setChosenLanguages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [alignment, setAlignment] = useState("Neutral");
  const [level, setLevel] = useState(1);
  const [chosenCantrips, setChosenCantrips] = useState<string[]>([]);
  const [chosenSpells, setChosenSpells] = useState<string[]>([]);
  const [chosenRacialCantrip, setChosenRacialCantrip] = useState<string[]>([]);
  const [equipmentChoices, setEquipmentChoices] = useState<Record<string, string>>({});
  const [moneyMethod, setMoneyMethod] = useState<MoneyMethod>("fixed");
  const [keepBgEquipmentOnRoll, setKeepBgEquipmentOnRoll] = useState(true);
  const [rolledGold, setRolledGold] = useState<number | null>(null);
  const [goldRolls, setGoldRolls] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  const variant = useMemo<RaceVariant | null>(() => {
    if (!race?.variants || !variantId) return null;
    return race.variants.find((v) => v.id === variantId) ?? null;
  }, [race, variantId]);

  const racialBonus = useMemo(() => {
    const bonus: Partial<Record<Ability, number>> = { ...(race?.abilityBonus ?? {}) };
    if (variant?.abilityBonus) {
      for (const [k, v] of Object.entries(variant.abilityBonus)) {
        bonus[k as Ability] = (bonus[k as Ability] ?? 0) + (v ?? 0);
      }
    }
    if (race?.id === "semielfo") {
      for (const a of halfElfBonus) bonus[a] = (bonus[a] ?? 0) + 1;
    }
    return bonus;
  }, [race, variant, halfElfBonus]);

  const effective = useMemo(() => {
    const e: Record<Ability, number> = { ...abilities };
    for (const [k, v] of Object.entries(racialBonus)) e[k as Ability] += v ?? 0;
    return e;
  }, [abilities, racialBonus]);

  const effectiveSpeed = variant?.speedOverride ?? race?.speed ?? 30;

  const conMod = abilityMod(effective.con);
  const hpBonusPerLevel = variant?.hpBonusPerLevel ?? 0;
  const maxHp = klass ? maxHpAtLevel1(klass.hitDie, conMod) + hpBonusPerLevel * level : 0;
  const prof = proficiencyBonus(level);

  const equipmentChoiceComplete = useMemo(() => {
    if (!klass) return false;
    return klass.startingEquipmentChoices.every((c) => equipmentChoices[c.id]);
  }, [klass, equipmentChoices]);

  const extraLanguageCount =
    (race?.bonusLanguages ?? 0) + (variant?.bonusLanguages ?? 0) + (background?.languages ?? 0);
  const racialBonusSkills = race?.bonusSkills ?? 0;

  const cantripsExpected = klass?.spellcasting?.cantripsKnown ?? 0;
  const spellsExpected = klass?.spellcasting
    ? firstLevelSpellPicks(klass.spellcasting, level, effective[klass.spellcasting.ability])
    : 0;
  const racialCantripChoice = variant?.cantripChoice ?? race?.cantripChoice ?? null;
  const spellsStepVisible =
    (Boolean(klass?.spellcasting) && (cantripsExpected > 0 || spellsExpected > 0)) ||
    Boolean(racialCantripChoice);

  const knownLanguagesSet = useMemo(() => {
    const base = new Set<string>(race?.languages ?? []);
    for (const l of variant?.extraLanguages ?? []) base.add(l);
    return base;
  }, [race, variant]);

  function buildEquipment(): EquipmentItem[] {
    if (!klass || !background) return [];
    const bgItems: EquipmentItem[] = background.equipment.map((n) => ({ name: n, qty: 1 }));
    if (moneyMethod === "rolled") {
      // PHB p. 143: al rolar oro inicial, sólo llevas lo que compres.
      // House rule: el usuario puede conservar los objetos del trasfondo con el toggle.
      return keepBgEquipmentOnRoll ? bgItems : [];
    }
    const chosen: EquipmentItem[] = [];
    for (const choice of klass.startingEquipmentChoices) {
      const picked = equipmentChoices[choice.id];
      const opt = choice.options.find((o) => o.id === picked);
      if (opt) chosen.push(...opt.items);
    }
    return [...klass.startingEquipmentFixed, ...chosen, ...bgItems];
  }

  const ac = useMemo(
    () =>
      computeAc({
        equipment: buildEquipment(),
        abilityScores: abilities,
        racialBonus,
        klassId: klass?.id,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abilities, racialBonus, klass, background, equipmentChoices, moneyMethod, keepBgEquipmentOnRoll],
  );

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
    const combinedSkills = mergeUnique(skills, bonusSkills);
    const baseLangs = mergeUnique(race.languages, variant?.extraLanguages);
    const allLanguages = mergeUnique(baseLangs, chosenLanguages);
    const payload = {
      name,
      playerName: playerName || undefined,
      level,
      race: race.id,
      class: klass.id,
      background: background.id,
      alignment,
      abilities,
      abilityRacialBonus: racialBonus,
      skills: combinedSkills,
      savingThrows: klass.savingThrows,
      hp: { max: maxHp, current: maxHp, temp: 0, hitDie: klass.hitDie },
      ac,
      speed: effectiveSpeed,
      initiativeBonus: 0,
      subrace: variant?.id,
      proficiencies: {
        armor: mergeUnique(klass.armorProficiencies, variant?.extraArmorProficiencies),
        weapons: mergeUnique(klass.weaponProficiencies, variant?.extraWeaponProficiencies),
        tools: [...(klass.toolProficiencies ?? []), ...background.tools],
        languages: allLanguages,
      },
      equipment,
      money,
      spells: klass.spellcasting
        ? {
            ability: klass.spellcasting.ability,
            known: buildKnownSpells({
              chosenCantrips,
              chosenSpells,
              chosenRacialCantrip,
              grantedRacialCantrips: [
                ...(race.grantedCantrips ?? []),
                ...(variant?.grantedCantrips ?? []),
              ],
              preparation: klass.spellcasting.preparation,
            }),
            slots: Object.fromEntries(spellSlotsFor(klass.spellcasting.caster, level).map((n, i) => [String(i + 1), { max: n, used: 0 }])),
          }
        : {
            known: buildKnownSpells({
              chosenCantrips: [],
              chosenSpells: [],
              chosenRacialCantrip,
              grantedRacialCantrips: [
                ...(race.grantedCantrips ?? []),
                ...(variant?.grantedCantrips ?? []),
              ],
            }),
            slots: {},
          },
      features: [{ name: background.feature.name, source: background.label, text: background.feature.text }],
    };
    const res = await fetch("/api/character", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await res.json()) as { id: string };
    router.push(`/character/${data.id}`);
  }

  function goNext() {
    let idx = Math.min(STEPS.length - 1, stepIdx + 1);
    while (STEPS[idx].id === "spells" && !spellsStepVisible && idx < STEPS.length - 1) idx += 1;
    setStep(STEPS[idx].id);
  }
  function goPrev() {
    let idx = Math.max(0, stepIdx - 1);
    while (STEPS[idx].id === "spells" && !spellsStepVisible && idx > 0) idx -= 1;
    setStep(STEPS[idx].id);
  }

  const nextDisabled = ((): boolean => {
    if (step === "race") {
      if (!race) return true;
      if (race.variants && race.variants.length > 0 && !variantId) return true;
      if (race.id === "semielfo" && halfElfBonus.length !== 2) return true;
      return false;
    }
    if (step === "class") return !klass;
    if (step === "background") {
      if (!background) return true;
      if (chosenLanguages.length !== extraLanguageCount) return true;
      return false;
    }
    if (step === "skills" && klass) {
      const bgSet = new Set(background?.skillProficiencies ?? []);
      const classSkills = skills.filter((s) => !bgSet.has(s));
      if (classSkills.length !== klass.skillChoices.count) return true;
      if (racialBonusSkills > 0 && bonusSkills.length !== racialBonusSkills) return true;
      return false;
    }
    if (step === "spells") {
      if (!spellsStepVisible) return false;
      if (chosenCantrips.length !== cantripsExpected) return true;
      if (chosenSpells.length !== spellsExpected) return true;
      if (racialCantripChoice && chosenRacialCantrip.length !== racialCantripChoice.count) return true;
      return false;
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
      <Stepper
        steps={STEPS.filter((s) => s.id !== "spells" || spellsStepVisible)}
        currentId={step}
        onGo={(s) => setStep(s.id)}
      />
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_340px]">
        <div className="stagger">
          {step === "race" && (
            <RaceStep
              race={race}
              onPick={(r) => {
                setRace(r);
                setVariantId("");
                setChosenLanguages([]);
                setBonusSkills([]);
                setChosenRacialCantrip([]);
                if (r.id !== "semielfo") setHalfElfBonus([]);
              }}
              variantId={variantId}
              onPickVariant={(id) => {
                setVariantId(id);
                setChosenLanguages([]);
                setChosenRacialCantrip([]);
              }}
              halfElfBonus={halfElfBonus}
              setHalfElfBonus={setHalfElfBonus}
            />
          )}
          {step === "class" && (
            <ClassStep
              klass={klass}
              onPick={(c) => {
                setKlass(c);
                setChosenCantrips([]);
                setChosenSpells([]);
              }}
            />
          )}
          {step === "background" && (
            <BackgroundStep
              bg={background}
              onPick={(b) => {
                setBackground(b);
                setChosenLanguages([]);
              }}
              extraLanguageCount={extraLanguageCount}
              knownLanguagesSet={knownLanguagesSet}
              chosenLanguages={chosenLanguages}
              setChosenLanguages={setChosenLanguages}
            />
          )}
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
            <SkillsStep
              klass={klass}
              bg={background}
              skills={skills}
              setSkills={setSkills}
              race={race}
              bonusSkills={bonusSkills}
              setBonusSkills={setBonusSkills}
            />
          )}
          {step === "spells" && (
            <SpellsStep
              klass={klass}
              race={race}
              variant={variant}
              cantripsExpected={cantripsExpected}
              spellsExpected={spellsExpected}
              racialCantripChoice={racialCantripChoice}
              chosenCantrips={chosenCantrips}
              setChosenCantrips={setChosenCantrips}
              chosenSpells={chosenSpells}
              setChosenSpells={setChosenSpells}
              chosenRacialCantrip={chosenRacialCantrip}
              setChosenRacialCantrip={setChosenRacialCantrip}
            />
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
              keepBgEquipmentOnRoll={keepBgEquipmentOnRoll}
              setKeepBgEquipmentOnRoll={setKeepBgEquipmentOnRoll}
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
              skills={mergeUnique(skills, bonusSkills)}
              languages={mergeUnique(mergeUnique(race?.languages ?? [], variant?.extraLanguages), chosenLanguages)}
              spells={buildKnownSpells({
                chosenCantrips,
                chosenSpells,
                chosenRacialCantrip,
                grantedRacialCantrips: [
                  ...(race?.grantedCantrips ?? []),
                  ...(variant?.grantedCantrips ?? []),
                ],
                preparation: klass?.spellcasting?.preparation,
              })}
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
              <dd>{race?.label ?? "—"}{variant ? ` · ${variant.label}` : ""}</dd>
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
  currentId,
  onGo,
}: {
  steps: { id: Step; label: string }[];
  currentId: Step;
  onGo: (s: { id: Step; label: string }) => void;
}) {
  const current = steps.findIndex((s) => s.id === currentId);
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

function RaceStep({
  race,
  onPick,
  variantId,
  onPickVariant,
  halfElfBonus,
  setHalfElfBonus,
}: {
  race: RaceBasics | null;
  onPick: (r: RaceBasics) => void;
  variantId: string;
  onPickVariant: (id: string) => void;
  halfElfBonus: Ability[];
  setHalfElfBonus: (a: Ability[]) => void;
}) {
  const toggleHalfElf = (a: Ability) => {
    if (a === "car") return;
    const next = new Set(halfElfBonus);
    if (next.has(a)) next.delete(a);
    else {
      if (next.size >= 2) return;
      next.add(a);
    }
    setHalfElfBonus(Array.from(next));
  };
  return (
    <div>
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
            {r.variants && r.variants.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>
                {r.variants.length} {r.variantLabel?.toLowerCase() ?? "variantes"} disponibles
              </p>
            )}
          </button>
        ))}
      </div>
      {race?.variants && race.variants.length > 0 && (
        <div className="mt-5 card">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">{race.variantLabel ?? "Subraza"}: elige una</p>
            <span className="badge" style={{ color: variantId ? "var(--color-accent)" : undefined }}>
              {variantId ? "seleccionada" : "pendiente"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {race.variants.map((v) => {
              const picked = v.id === variantId;
              const bonus = v.abilityBonus
                ? Object.entries(v.abilityBonus)
                    .map(([k, n]) => `${k.toUpperCase()} +${n}`)
                    .join(", ")
                : null;
              return (
                <button
                  key={v.id}
                  onClick={() => onPickVariant(v.id)}
                  className={picked ? "card-accent text-left" : "card text-left"}
                  style={{ padding: "12px 14px" }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm">{v.label}</p>
                    {v.damageType && <span className="badge">{v.damageType}</span>}
                  </div>
                  {bonus && (
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {bonus}
                      {v.speedOverride ? ` · Vel. ${v.speedOverride}` : ""}
                      {v.hpBonusPerLevel ? ` · +${v.hpBonusPerLevel} PG/nivel` : ""}
                    </p>
                  )}
                  {v.traits && v.traits.length > 0 && (
                    <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {v.traits.join(" · ")}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {race?.id === "semielfo" && (
        <div className="mt-5 card">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">Versatilidad semielfa: elige +1 a dos atributos (distintos de Carisma)</p>
            <span className="badge" style={{ color: halfElfBonus.length === 2 ? "var(--color-accent)" : undefined }}>
              {halfElfBonus.length}/2
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {(ABILITIES.filter((a) => a !== "car") as Ability[]).map((a) => {
              const checked = halfElfBonus.includes(a);
              const disabled = !checked && halfElfBonus.length >= 2;
              return (
                <label
                  key={a}
                  className={checked ? "card-accent flex items-center justify-between py-2" : "card flex items-center justify-between py-2"}
                  style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
                >
                  <span className="label uppercase">{a}</span>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleHalfElf(a)} />
                </label>
              );
            })}
          </div>
        </div>
      )}
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

function BackgroundStep({
  bg,
  onPick,
  extraLanguageCount,
  knownLanguagesSet,
  chosenLanguages,
  setChosenLanguages,
}: {
  bg: BackgroundBasics | null;
  onPick: (b: BackgroundBasics) => void;
  extraLanguageCount: number;
  knownLanguagesSet: Set<string>;
  chosenLanguages: string[];
  setChosenLanguages: (ls: string[]) => void;
}) {
  const toggleLang = (lang: string) => {
    const next = new Set(chosenLanguages);
    if (next.has(lang)) next.delete(lang);
    else {
      if (next.size >= extraLanguageCount) return;
      next.add(lang);
    }
    setChosenLanguages(Array.from(next));
  };
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {BACKGROUNDS.map((b) => (
          <button key={b.id} onClick={() => onPick(b)} className={b.id === bg?.id ? "card-accent text-left" : "card text-left"}>
            <h3>{b.label}</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
              Habilidades: {b.skillProficiencies.map((s) => SKILLS[s]?.label ?? s).join(", ")} · {b.startingMoney.gp} po
              {b.languages > 0 ? ` · +${b.languages} idioma${b.languages === 1 ? "" : "s"}` : ""}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <strong>{b.feature.name}</strong>: {b.feature.text}
            </p>
          </button>
        ))}
      </div>
      {bg && extraLanguageCount > 0 && (
        <div className="mt-5 card">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">Idiomas adicionales: elige {extraLanguageCount}</p>
            <span className="badge" style={{ color: chosenLanguages.length === extraLanguageCount ? "var(--color-accent)" : undefined }}>
              {chosenLanguages.length}/{extraLanguageCount}
            </span>
          </div>
          <p className="mb-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
            Combinamos los idiomas raciales, de subraza y de trasfondo. No puedes elegir uno que ya hables.
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {STANDARD_LANGUAGES.map((lang) => {
              const alreadyKnown = knownLanguagesSet.has(lang);
              const checked = chosenLanguages.includes(lang);
              const disabled = alreadyKnown || (!checked && chosenLanguages.length >= extraLanguageCount);
              return (
                <label
                  key={lang}
                  className={checked ? "card-accent flex items-center justify-between py-2" : "card flex items-center justify-between py-2"}
                  style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: alreadyKnown ? 0.45 : 1, padding: "10px 12px" }}
                >
                  <span className="text-sm">
                    {lang}
                    {alreadyKnown && (
                      <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        · ya lo hablas
                      </span>
                    )}
                  </span>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleLang(lang)} />
                </label>
              );
            })}
          </div>
        </div>
      )}
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
  race,
  bonusSkills,
  setBonusSkills,
}: {
  klass: ClassBasics | null;
  bg: BackgroundBasics | null;
  skills: string[];
  setSkills: (s: string[]) => void;
  race: RaceBasics | null;
  bonusSkills: string[];
  setBonusSkills: (s: string[]) => void;
}) {
  const bgSkills = new Set(bg?.skillProficiencies ?? []);
  const classList = new Set(klass?.skillChoices.from ?? []);
  const picked = new Set(skills);
  const classPicks = skills.filter((s) => !bgSkills.has(s));
  const limit = klass?.skillChoices.count ?? 0;
  const remaining = Math.max(0, limit - classPicks.length);
  const racialBonusSkills = race?.bonusSkills ?? 0;

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

  const toggleBonus = (key: string) => {
    const next = new Set(bonusSkills);
    if (next.has(key)) next.delete(key);
    else {
      if (next.size >= racialBonusSkills) return;
      next.add(key);
    }
    setBonusSkills(Array.from(next));
  };

  if (!klass || !bg) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
        Selecciona clase y trasfondo antes de elegir habilidades.
      </p>
    );
  }

  const bonusPicksRemaining = Math.max(0, racialBonusSkills - bonusSkills.length);

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

      {racialBonusSkills > 0 && (
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              Versatilidad de habilidades ({race?.label}): elige {racialBonusSkills} habilidades adicionales a tu elección.
            </p>
            <span className="badge" style={{ color: bonusPicksRemaining === 0 ? "var(--color-accent)" : undefined }}>
              {bonusSkills.length}/{racialBonusSkills}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.entries(SKILLS).map(([key, s]) => {
              const alreadyChosen = bgSkills.has(key) || picked.has(key);
              const checked = bonusSkills.includes(key);
              const disabled = alreadyChosen || (!checked && bonusPicksRemaining === 0);
              return (
                <label
                  key={`bonus-${key}`}
                  className={checked ? "card-accent flex items-center justify-between py-3" : "card flex items-center justify-between py-3"}
                  style={{ opacity: alreadyChosen ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
                >
                  <div>
                    <p className="text-sm">{s.label}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {ABILITY_LABEL[s.ability]}
                      {alreadyChosen ? " · ya seleccionada" : " · racial"}
                    </p>
                  </div>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleBonus(key)} />
                </label>
              );
            })}
          </div>
        </div>
      )}
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
  keepBgEquipmentOnRoll,
  setKeepBgEquipmentOnRoll,
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
  keepBgEquipmentOnRoll: boolean;
  setKeepBgEquipmentOnRoll: (v: boolean) => void;
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
        <>
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
          <label
            className={keepBgEquipmentOnRoll ? "card-accent flex items-center justify-between" : "card flex items-center justify-between"}
            style={{ padding: "14px 16px", cursor: "pointer" }}
          >
            <div>
              <p className="text-sm">Conservar objetos del trasfondo</p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                Por RAW (PHB p. 143) al rolar oro inicial sólo llevas lo que compres. Esta regla de casa deja los objetos del trasfondo
                {" "}{background.label}; desactívala para ajustarte al reglamento estricto.
              </p>
            </div>
            <input
              type="checkbox"
              checked={keepBgEquipmentOnRoll}
              onChange={(e) => setKeepBgEquipmentOnRoll(e.target.checked)}
            />
          </label>
        </>
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
        {moneyMethod === "rolled" && !keepBgEquipmentOnRoll && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-accent)" }}>
            Estos objetos no se añadirán a tu inventario porque desactivaste la regla de casa.
          </p>
        )}
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
  languages,
  spells,
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
  languages: string[];
  spells: { name: string; level: number; prepared: boolean }[];
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
        <p className="label mb-2">Idiomas</p>
        <p className="text-sm">{languages.length ? languages.join(", ") : "—"}</p>
      </div>

      {spells.length > 0 && (
        <div className="card">
          <p className="label mb-2">Conjuros iniciales</p>
          <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            {spells.map((s, i) => (
              <li key={i}>
                <span style={{ color: "var(--color-accent)" }}>{s.level === 0 ? "Truco" : `Nv ${s.level}`}</span> ·{" "}
                {s.name}
                {!s.prepared && (
                  <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                    · en grimorio
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

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

function SpellsStep({
  klass,
  race,
  variant,
  cantripsExpected,
  spellsExpected,
  racialCantripChoice,
  chosenCantrips,
  setChosenCantrips,
  chosenSpells,
  setChosenSpells,
  chosenRacialCantrip,
  setChosenRacialCantrip,
}: {
  klass: ClassBasics | null;
  race: RaceBasics | null;
  variant: RaceVariant | null;
  cantripsExpected: number;
  spellsExpected: number;
  racialCantripChoice: { fromClass: string; ability: Ability; count: number } | null;
  chosenCantrips: string[];
  setChosenCantrips: (s: string[]) => void;
  chosenSpells: string[];
  setChosenSpells: (s: string[]) => void;
  chosenRacialCantrip: string[];
  setChosenRacialCantrip: (s: string[]) => void;
}) {
  const classId = (klass?.id ?? "") as SpellClassId;
  const classCantrips = useMemo<Spell[]>(
    () => (classId ? spellsForClassAtLevel(classId, 0) : []),
    [classId],
  );
  const classSpells = useMemo<Spell[]>(
    () => (classId ? spellsForClassAtLevel(classId, 1) : []),
    [classId],
  );
  const racialPool = useMemo<Spell[]>(() => {
    if (!racialCantripChoice) return [];
    return spellsForClassAtLevel(racialCantripChoice.fromClass as SpellClassId, 0);
  }, [racialCantripChoice]);

  const grantedRacial: { spell: Spell; ability: Ability; source: string }[] = useMemo(() => {
    const grants = [...(race?.grantedCantrips ?? []), ...(variant?.grantedCantrips ?? [])];
    return grants
      .map((g) => {
        const spell = SPELLS.find((s) => s.id === g.spellId);
        if (!spell) return null;
        return { spell, ability: g.ability, source: variant?.label ?? race?.label ?? "raza" };
      })
      .filter((x): x is { spell: Spell; ability: Ability; source: string } => x != null);
  }, [race, variant]);

  const toggleFrom = (list: string[], setList: (v: string[]) => void, max: number, id: string) => {
    const set = new Set(list);
    if (set.has(id)) set.delete(id);
    else {
      if (set.size >= max) return;
      set.add(id);
    }
    setList(Array.from(set));
  };

  const preparation = klass?.spellcasting?.preparation;
  const spellsAbility = klass?.spellcasting?.ability;
  const spellsLabel = preparation === "spellbook"
    ? `Grimorio inicial: elige ${spellsExpected} conjuros de nivel 1 para copiarlos a tu libro`
    : preparation === "prepared" && spellsAbility
      ? `Conjuros preparados (nivel + mod ${ABILITY_LABEL[spellsAbility]}): elige ${spellsExpected}`
      : `Conjuros conocidos: elige ${spellsExpected} conjuros de nivel 1`;

  const introText = klass?.spellcasting
    ? `Selecciona los trucos y conjuros que tu ${klass.label.toLowerCase()} conoce al nivel 1.`
    : "Tu raza te otorga conjuros raciales que completar.";
  const cantripsHeader = klass?.spellcasting
    ? `Trucos de ${klass.label.toLowerCase()}: elige ${cantripsExpected}`
    : `Trucos: elige ${cantripsExpected}`;

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {introText}
          {preparation === "prepared" && " Los preparados cambian tras un descanso largo."}
          {preparation === "spellbook" && " Podrás preparar hasta nivel + mod INT de entre ellos cada día."}
        </p>
      </div>

      {cantripsExpected > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">{cantripsHeader}</p>
            <span className="badge" style={{ color: chosenCantrips.length === cantripsExpected ? "var(--color-accent)" : undefined }}>
              {chosenCantrips.length}/{cantripsExpected}
            </span>
          </div>
          <SpellGrid
            spells={classCantrips}
            selected={chosenCantrips}
            onToggle={(id) => toggleFrom(chosenCantrips, setChosenCantrips, cantripsExpected, id)}
            max={cantripsExpected}
          />
        </div>
      )}

      {spellsExpected > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">{spellsLabel}</p>
            <span className="badge" style={{ color: chosenSpells.length === spellsExpected ? "var(--color-accent)" : undefined }}>
              {chosenSpells.length}/{spellsExpected}
            </span>
          </div>
          <SpellGrid
            spells={classSpells}
            selected={chosenSpells}
            onToggle={(id) => toggleFrom(chosenSpells, setChosenSpells, spellsExpected, id)}
            max={spellsExpected}
          />
        </div>
      )}

      {racialCantripChoice && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">
              Truco racial de {variant?.label ?? race?.label}: elige {racialCantripChoice.count} de la lista de{" "}
              {racialCantripChoice.fromClass} (se lanza con {ABILITY_LABEL[racialCantripChoice.ability]})
            </p>
            <span className="badge" style={{ color: chosenRacialCantrip.length === racialCantripChoice.count ? "var(--color-accent)" : undefined }}>
              {chosenRacialCantrip.length}/{racialCantripChoice.count}
            </span>
          </div>
          <SpellGrid
            spells={racialPool}
            selected={chosenRacialCantrip}
            onToggle={(id) => toggleFrom(chosenRacialCantrip, setChosenRacialCantrip, racialCantripChoice.count, id)}
            max={racialCantripChoice.count}
          />
        </div>
      )}

      {grantedRacial.length > 0 && (
        <div className="card">
          <p className="label mb-2">Trucos otorgados por tu raza/subraza</p>
          <ul className="space-y-1 text-sm">
            {grantedRacial.map((g) => (
              <li key={g.spell.id}>
                <strong>{g.spell.name}</strong>{" "}
                <span style={{ color: "var(--color-text-hint)" }}>
                  · {g.source} · {ABILITY_LABEL[g.ability]} · {g.spell.description}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SpellGrid({
  spells,
  selected,
  onToggle,
  max,
}: {
  spells: Spell[];
  selected: string[];
  onToggle: (id: string) => void;
  max: number;
}) {
  if (spells.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
        No hay conjuros disponibles para esta selección.
      </p>
    );
  }
  const full = selected.length >= max;
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {spells.map((s) => {
        const checked = selected.includes(s.id);
        const disabled = !checked && full;
        const tags = [
          s.school.charAt(0).toUpperCase() + s.school.slice(1),
          s.ritual ? "Ritual" : null,
          s.concentration ? "Concentración" : null,
        ].filter(Boolean);
        return (
          <label
            key={s.id}
            className={checked ? "card-accent text-left" : "card text-left"}
            style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, padding: "12px 14px" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm">
                  <strong>{s.name}</strong>
                  <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                    {tags.join(" · ")}
                  </span>
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {s.description}
                </p>
              </div>
              <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(s.id)} />
            </div>
          </label>
        );
      })}
    </div>
  );
}

function buildKnownSpells(params: {
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenRacialCantrip: string[];
  grantedRacialCantrips: { spellId: string; ability: Ability }[];
  preparation?: "known" | "prepared" | "spellbook";
}): { name: string; level: number; prepared: boolean }[] {
  const { chosenCantrips, chosenSpells, chosenRacialCantrip, grantedRacialCantrips, preparation } = params;
  const out: { name: string; level: number; prepared: boolean }[] = [];
  const seen = new Set<string>();
  const push = (spellId: string, prepared: boolean) => {
    if (seen.has(spellId)) return;
    const spell = SPELLS.find((s) => s.id === spellId);
    if (!spell) return;
    seen.add(spellId);
    out.push({ name: spell.name, level: spell.level, prepared });
  };
  for (const id of chosenCantrips) push(id, true);
  for (const id of chosenRacialCantrip) push(id, true);
  for (const g of grantedRacialCantrips) push(g.spellId, true);
  // Para mago con grimorio: los 6 conjuros iniciales están en el libro pero aún no preparados.
  // Al nivel 1 se puede preparar hasta `level + mod INT`; por simplicidad marcamos todos como preparados
  // salvo el caso del mago, donde los dejamos como "no preparados" (el jugador ajustará después).
  const spellsPrepared = preparation !== "spellbook";
  for (const id of chosenSpells) push(id, spellsPrepared);
  return out;
}

function mergeUnique(base: string[], extra?: string[]): string[] {
  if (!extra || extra.length === 0) return [...base];
  const seen = new Set(base);
  const out = [...base];
  for (const item of extra) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}
