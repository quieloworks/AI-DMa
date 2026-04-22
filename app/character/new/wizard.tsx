"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  backgroundToolPickSpecs,
  resolveBackgroundTools,
  toolsInPool,
  validateBackgroundToolPicks,
  validateClassToolPicks,
} from "@/lib/tools";
import { useRouter } from "next/navigation";
import {
  ABILITIES,
  BACKGROUNDS,
  CLASSES,
  RACES,
  SKILLS,
  STANDARD_ARRAY,
  STANDARD_LANGUAGES,
  abilityMod,
  asiCountForClassAtLevel,
  asiLevelsForClass,
  computeAc,
  firstLevelSpellPicks,
  maxCastableSpellLevel,
  maxHpAtLevel,
  maxHpFromLevelRolls,
  pointBuyTotal,
  proficiencyBonus,
  spellSlotsFor,
  wizardPreparedCount,
  fightingStylesForClass,
  fightingStyleSlots,
  FIGHTING_STYLES,
  type Ability,
  type FightingStyleId,
  type BackgroundBasics,
  type ClassBasics,
  type EquipmentItem,
  type FightingStyle,
  type RaceBasics,
  type RaceVariant,
  type AsiSlotChoice,
} from "@/lib/character";
import { SPELLS, spellsForClassAtLevel, spellsForClassUpToLevel, type Spell, type SpellClassId } from "@/lib/spells";
import { FEATS, type Feat } from "@/lib/feats";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import {
  localizeGamePhrase,
  localizedBackgroundBasics,
  localizedClassBasics,
  localizedRaceBasics,
  localizedRaceVariant,
  localizedAbilityLabel,
  localizedSkillLabel,
  localizedSpellSchool,
  localizedFightingStyle,
  featForLocale,
} from "@/lib/i18n/game-localize";
import { spellForLocale, spellSortLocale } from "@/lib/i18n/spell-i18n";
import type { AppLocale } from "@/lib/i18n/locale";
import { displayLanguageName } from "@/lib/i18n/language-names";

type Step =
  | "race"
  | "class"
  | "background"
  | "abilities"
  | "feats"
  | "skills"
  | "spells"
  | "details"
  | "estilo"
  | "equipo"
  | "review";

type AbilityMethod = "standard" | "pointbuy" | "roll";
type MoneyMethod = "fixed" | "rolled";

const ALIGNMENT_CODES = ["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"] as const;

function alignmentLabel(code: string, tr: (path: string, vars?: Record<string, string | number>) => string): string {
  if ((ALIGNMENT_CODES as readonly string[]).includes(code)) return tr(`wizard.alignment.${code}`);
  return code;
}

// ASI vs dote a los niveles 4/8/12/16/19 (más 6/14 guerrero, 10 pícaro). PHB p. 15 y tablas de clase.
// - kind "none": slot sin decidir (inválido para avanzar).
// - kind "asi":   `picks` = [ability] para +2 al mismo atributo, o [a1, a2] distintos para +1 cada uno.
// - kind "feat":  selecciona un `featId`. Si la dote da +1 a elección de varios atributos, `abilityChoice` lo indica.
// Los slots resueltos se persisten en `Character.asiChoices` (`AsiSlotChoice`).
export type AsiChoice = AsiSlotChoice | { kind: "none" };

export function CharacterWizard() {
  const router = useRouter();
  const tr = useTranslations();
  const locale = useLocale();
  const STEPS = useMemo(() => {
    const meta: [Step, string][] = [
      ["race", "wizard.step.race"],
      ["class", "wizard.step.class"],
      ["background", "wizard.step.background"],
      ["abilities", "wizard.step.abilities"],
      ["feats", "wizard.step.feats"],
      ["skills", "wizard.step.skills"],
      ["spells", "wizard.step.spells"],
      ["details", "wizard.step.details"],
      ["estilo", "wizard.step.fightingStyle"],
      ["equipo", "wizard.step.equipment"],
      ["review", "wizard.step.review"],
    ];
    return meta.map(([id, key]) => ({ id, label: tr(key) }));
  }, [tr]);
  const [step, setStep] = useState<Step>("race");
  const [race, setRace] = useState<RaceBasics | null>(null);
  const [variantId, setVariantId] = useState<string>("");
  const [halfElfBonus, setHalfElfBonus] = useState<Ability[]>([]);
  const [customAbilityPicks, setCustomAbilityPicks] = useState<Ability[]>([]);
  const [chosenFeats, setChosenFeats] = useState<string[]>([]);
  const [featAbilityChoices, setFeatAbilityChoices] = useState<Record<string, Ability>>({});
  const [asiChoices, setAsiChoices] = useState<AsiChoice[]>([]);
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
  const [alignment, setAlignment] = useState<string>("N");
  const [level, setLevel] = useState(1);
  const [chosenCantrips, setChosenCantrips] = useState<string[]>([]);
  const [chosenSpells, setChosenSpells] = useState<string[]>([]);
  const [chosenPrepared, setChosenPrepared] = useState<string[]>([]);
  const [chosenRacialCantrip, setChosenRacialCantrip] = useState<string[]>([]);
  const [equipmentChoices, setEquipmentChoices] = useState<Record<string, string>>({});
  const [moneyMethod, setMoneyMethod] = useState<MoneyMethod>("fixed");
  const [keepBgEquipmentOnRoll, setKeepBgEquipmentOnRoll] = useState(true);
  const [rolledGold, setRolledGold] = useState<number | null>(null);
  const [goldRolls, setGoldRolls] = useState<number[]>([]);
  const [chosenFightingStyles, setChosenFightingStyles] = useState<string[]>([]);
  const [classToolPicks, setClassToolPicks] = useState<string[]>([]);
  const [bgToolPicks, setBgToolPicks] = useState<string[]>([]);
  /** PHB p. 15: «promedio» fijo del PHB vs tiradas por nivel ≥2. */
  const [hpGeneration, setHpGeneration] = useState<"average" | "rolled">("average");
  const [hpLevelRolls, setHpLevelRolls] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const stepIdx = STEPS.findIndex((s) => s.id === step);

  useEffect(() => {
    setClassToolPicks([]);
  }, [klass?.id]);

  useEffect(() => {
    if (!background) {
      setBgToolPicks([]);
      return;
    }
    const n = backgroundToolPickSpecs(background).length;
    setBgToolPicks(Array.from({ length: n }, () => ""));
  }, [background?.id]);

  const reviewTools = useMemo(() => {
    if (!klass || !background) return [];
    const bgPart =
      backgroundToolPickSpecs(background).length > 0
        ? resolveBackgroundTools(background, bgToolPicks)
        : [...background.tools];
    return mergeUnique([...(klass.toolProficiencies ?? []), ...classToolPicks.filter(Boolean), ...bgPart]);
  }, [klass, background, classToolPicks, bgToolPicks]);

  const variant = useMemo<RaceVariant | null>(() => {
    if (!race?.variants || !variantId) return null;
    return race.variants.find((v) => v.id === variantId) ?? null;
  }, [race, variantId]);

  const customAbilityRule = variant?.customAbilityBonus ?? race?.customAbilityBonus ?? null;

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
    if (customAbilityRule && customAbilityPicks.length > 0) {
      for (const a of customAbilityPicks) bonus[a] = (bonus[a] ?? 0) + customAbilityRule.value;
    }
    for (const featId of chosenFeats) {
      const feat = FEATS.find((f) => f.id === featId);
      if (!feat?.abilityBonus) continue;
      const ab = feat.abilityBonus.from.length === 1
        ? feat.abilityBonus.from[0]
        : featAbilityChoices[featId];
      if (!ab) continue;
      bonus[ab] = (bonus[ab] ?? 0) + feat.abilityBonus.value;
    }
    for (const choice of asiChoices) {
      if (choice.kind === "asi") {
        if (choice.picks.length === 1) {
          bonus[choice.picks[0]] = (bonus[choice.picks[0]] ?? 0) + 2;
        } else if (choice.picks.length === 2) {
          bonus[choice.picks[0]] = (bonus[choice.picks[0]] ?? 0) + 1;
          bonus[choice.picks[1]] = (bonus[choice.picks[1]] ?? 0) + 1;
        }
      } else if (choice.kind === "feat") {
        const feat = FEATS.find((f) => f.id === choice.featId);
        if (!feat?.abilityBonus) continue;
        const ab = feat.abilityBonus.from.length === 1
          ? feat.abilityBonus.from[0]
          : choice.abilityChoice;
        if (!ab) continue;
        bonus[ab] = (bonus[ab] ?? 0) + feat.abilityBonus.value;
      }
    }
    return bonus;
  }, [race, variant, halfElfBonus, customAbilityRule, customAbilityPicks, chosenFeats, featAbilityChoices, asiChoices]);

  const effective = useMemo(() => {
    const e: Record<Ability, number> = { ...abilities };
    for (const [k, v] of Object.entries(racialBonus)) e[k as Ability] += v ?? 0;
    return e;
  }, [abilities, racialBonus]);

  // Tope RAW de 20 en atributos (PHB p. 12, recuadro "Ability Score Improvement": "You can't
  // increase an ability score above 20 using this feature"; íd. en descripción de cada dote
  // con ASI parcial, PHB p. 165). Para cada slot ASI calculamos el total del atributo que
  // tendrías EXCLUYENDO la contribución de ese mismo slot; dentro de AsiSlot se usa para
  // deshabilitar botones cuya selección rompería el tope.
  const asiSlotPreTotals = useMemo<Record<Ability, number>[]>(() => {
    return asiChoices.map((choice) => {
      const slotContrib: Record<Ability, number> = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
      if (choice.kind === "asi") {
        if (choice.picks.length === 1) slotContrib[choice.picks[0]] += 2;
        else if (choice.picks.length === 2) {
          slotContrib[choice.picks[0]] += 1;
          slotContrib[choice.picks[1]] += 1;
        }
      } else if (choice.kind === "feat") {
        const feat = FEATS.find((f) => f.id === choice.featId);
        if (feat?.abilityBonus) {
          const ab = feat.abilityBonus.from.length === 1 ? feat.abilityBonus.from[0] : choice.abilityChoice;
          if (ab) slotContrib[ab] += feat.abilityBonus.value;
        }
      }
      const pre: Record<Ability, number> = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
      for (const ab of ABILITIES) pre[ab] = abilities[ab] + (racialBonus[ab] ?? 0) - slotContrib[ab];
      return pre;
    });
  }, [asiChoices, abilities, racialBonus]);

  const effectiveSpeed = variant?.speedOverride ?? race?.speed ?? 30;

  const conMod = abilityMod(effective.con);
  const hpBonusPerLevel = variant?.hpBonusPerLevel ?? 0;
  // PHB p. 15: nivel 1 = máximo del dado + CON; niveles 2+ = promedio PHB o tiradas (`hpLevelRolls`).
  const maxHp = useMemo(() => {
    if (!klass) return 0;
    const racial = hpBonusPerLevel * level;
    if (hpGeneration === "rolled" && level > 1 && hpLevelRolls.length === level - 1) {
      return maxHpFromLevelRolls(klass.hitDie, conMod, level, hpLevelRolls) + racial;
    }
    return maxHpAtLevel(level, klass.hitDie, conMod) + racial;
  }, [klass, level, conMod, hpBonusPerLevel, hpGeneration, hpLevelRolls]);
  const prof = proficiencyBonus(level);

  const equipmentChoiceComplete = useMemo(() => {
    if (!klass) return false;
    return klass.startingEquipmentChoices.every((c) => equipmentChoices[c.id]);
  }, [klass, equipmentChoices]);

  const extraLanguageCount =
    (race?.bonusLanguages ?? 0) + (variant?.bonusLanguages ?? 0) + (background?.languages ?? 0);
  const racialBonusSkills = (race?.bonusSkills ?? 0) + (variant?.bonusSkills ?? 0);
  const featSlots = (race?.bonusFeats ?? 0) + (variant?.bonusFeats ?? 0);
  const asiSlots = klass ? asiCountForClassAtLevel(klass.id, level) : 0;
  const featsStepVisible = featSlots > 0 || asiSlots > 0;
  const styleSlots = klass ? fightingStyleSlots(klass.id, level) : 0;

  useEffect(() => {
    if (!klass) {
      setChosenFightingStyles([]);
      return;
    }
    const slots = fightingStyleSlots(klass.id, level);
    setChosenFightingStyles((prev) => {
      if (slots === 0) return [];
      const allowed = new Set<string>(fightingStylesForClass(klass.id).map((s) => s.id));
      const filtered = [...new Set(prev.filter((sid) => allowed.has(sid)))];
      return filtered.slice(0, slots);
    });
  }, [klass, level]);

  useEffect(() => {
    setAsiChoices((prev) => {
      if (prev.length === asiSlots) return prev;
      if (asiSlots < prev.length) return prev.slice(0, asiSlots);
      return [...prev, ...Array.from({ length: asiSlots - prev.length }, () => ({ kind: "none" } as AsiChoice))];
    });
  }, [asiSlots]);

  useEffect(() => {
    const n = Math.max(0, level - 1);
    if (hpGeneration !== "rolled" || n === 0) {
      setHpLevelRolls([]);
      return;
    }
    const hd = klass?.hitDie ?? 8;
    const defaultRoll = Math.floor(hd / 2) + 1;
    setHpLevelRolls((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(defaultRoll);
      return next;
    });
  }, [level, klass?.hitDie, hpGeneration]);

  useEffect(() => {
    if (!klass?.spellcasting) return;
    const maxLv = maxCastableSpellLevel(klass.spellcasting.caster, level);
    const cid = klass.id as SpellClassId;
    setChosenSpells((prev) =>
      prev.filter((id) => {
        const sp = SPELLS.find((s) => s.id === id);
        return Boolean(sp && sp.level >= 1 && sp.level <= maxLv && sp.classes.includes(cid));
      }),
    );
  }, [klass?.id, klass?.spellcasting, level]);

  const cantripsExpected = klass?.spellcasting?.cantripsKnown ?? 0;
  const spellsExpected = klass?.spellcasting
    ? firstLevelSpellPicks(klass.spellcasting, level, effective[klass.spellcasting.ability], klass.id)
    : 0;
  // Mago: tras copiar `spellbookCount` al grimorio, prepara `nivel + mod INT` cada día (PHB p. 114).
  const preparedExpected =
    klass?.spellcasting?.preparation === "spellbook" && chosenSpells.length > 0
      ? Math.min(
          chosenSpells.length,
          wizardPreparedCount(level, effective[klass.spellcasting.ability]),
        )
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
        fightingStyles: chosenFightingStyles as FightingStyleId[],
        otherAcBonus: 0,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abilities, racialBonus, klass, background, equipmentChoices, moneyMethod, keepBgEquipmentOnRoll, chosenFightingStyles],
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
    const fightingStyleFeatures = chosenFightingStyles.map((fid) => {
      const st = FIGHTING_STYLES.find((x) => x.id === fid);
      const stL = st ? localizedFightingStyle(st, locale) : null;
      return {
        name: stL ? `${tr("wizard.fightingStyle.savePrefix")}: ${stL.label}` : tr("wizard.fightingStyle.saveFallback"),
        source: localizedClassBasics(klass, locale).label,
        text: stL?.summary ?? "",
      };
    });

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
      fightingStyles: chosenFightingStyles,
      skills: combinedSkills,
      savingThrows: klass.savingThrows,
      hp: {
        max: maxHp,
        current: maxHp,
        temp: 0,
        hitDie: klass.hitDie,
        ...(hpGeneration === "rolled" && level > 1 && hpLevelRolls.length === level - 1
          ? { levelUpRolls: [...hpLevelRolls] }
          : {}),
      },
      ac,
      acOtherBonus: 0,
      speed: effectiveSpeed,
      initiativeBonus: 0,
      subrace: variant?.id,
      proficiencies: {
        armor: mergeUnique(klass.armorProficiencies, variant?.extraArmorProficiencies),
        weapons: mergeUnique(klass.weaponProficiencies, variant?.extraWeaponProficiencies),
        tools: mergeUnique([
          ...(klass.toolProficiencies ?? []),
          ...classToolPicks.filter(Boolean),
          ...(backgroundToolPickSpecs(background).length > 0
            ? resolveBackgroundTools(background, bgToolPicks)
            : background.tools),
        ]),
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
              chosenPrepared,
              chosenRacialCantrip,
              grantedRacialCantrips: [
                ...(race.grantedCantrips ?? []),
                ...(variant?.grantedCantrips ?? []),
              ],
              preparation: klass.spellcasting.preparation,
              preparedCaster:
                klass.spellcasting.preparation === "prepared"
                  ? {
                      classId: klass.id as SpellClassId,
                      characterLevel: level,
                      caster: klass.spellcasting.caster,
                    }
                  : undefined,
              locale,
            }),
            slots: Object.fromEntries(spellSlotsFor(klass.spellcasting.caster, level).map((n, i) => [String(i + 1), { max: n, used: 0 }])),
          }
        : {
            known: buildKnownSpells({
              chosenCantrips: [],
              chosenSpells: [],
              chosenPrepared: [],
              chosenRacialCantrip,
              grantedRacialCantrips: [
                ...(race.grantedCantrips ?? []),
                ...(variant?.grantedCantrips ?? []),
              ],
              locale,
            }),
            slots: {},
          },
      features: [
        {
          name: localizedBackgroundBasics(background, locale).feature.name,
          source: localizedBackgroundBasics(background, locale).label,
          text: localizedBackgroundBasics(background, locale).feature.text,
        },
        ...fightingStyleFeatures,
      ],
      feats: [
        ...chosenFeats,
        ...asiChoices.flatMap((c) => (c.kind === "feat" ? [c.featId] : [])),
      ],
      asiChoices: asiChoices.filter((c): c is AsiSlotChoice => c.kind !== "none"),
    };
    const res = await fetch("/api/character", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = (await res.json()) as { id: string };
    router.push(`/character/${data.id}`);
  }

  function isSkipped(id: Step) {
    if (id === "spells" && !spellsStepVisible) return true;
    if (id === "feats" && !featsStepVisible) return true;
    if (id === "estilo" && styleSlots === 0) return true;
    return false;
  }
  function goNext() {
    let idx = Math.min(STEPS.length - 1, stepIdx + 1);
    while (isSkipped(STEPS[idx].id) && idx < STEPS.length - 1) idx += 1;
    setStep(STEPS[idx].id);
  }
  function goPrev() {
    let idx = Math.max(0, stepIdx - 1);
    while (isSkipped(STEPS[idx].id) && idx > 0) idx -= 1;
    setStep(STEPS[idx].id);
  }

  const nextDisabled = ((): boolean => {
    if (step === "race") {
      if (!race) return true;
      if (race.variants && race.variants.length > 0 && !variantId) return true;
      if (race.id === "semielfo" && halfElfBonus.length !== 2) return true;
      if (customAbilityRule && customAbilityPicks.length !== customAbilityRule.count) return true;
      return false;
    }
    if (step === "class") return !klass;
    if (step === "background") {
      if (!background) return true;
      if (chosenLanguages.length !== extraLanguageCount) return true;
      return false;
    }
    if (step === "feats") {
      if (!featsStepVisible) return false;
      if (chosenFeats.length !== featSlots) return true;
      for (const featId of chosenFeats) {
        const feat = FEATS.find((f) => f.id === featId);
        if (feat?.abilityBonus && feat.abilityBonus.from.length > 1 && !featAbilityChoices[featId]) return true;
      }
      if (asiChoices.length !== asiSlots) return true;
      for (const ch of asiChoices) {
        if (ch.kind === "none") return true;
        if (ch.kind === "asi") {
          if (ch.picks.length === 0) return true;
          if (ch.picks.length > 2) return true;
          if (ch.picks.length === 2 && ch.picks[0] === ch.picks[1]) return true;
        } else if (ch.kind === "feat") {
          const feat = FEATS.find((f) => f.id === ch.featId);
          if (!feat) return true;
          if (feat.abilityBonus && feat.abilityBonus.from.length > 1 && !ch.abilityChoice) return true;
        }
      }
      // Tope RAW de 20 (PHB p. 12). Defensa en profundidad por si alguna ruta
      // dejó un atributo > 20 (las UI de AsiSlot / FeatList ya deshabilitan las acciones).
      for (const ab of ABILITIES) {
        if (abilities[ab] + (racialBonus[ab] ?? 0) > 20) return true;
      }
      return false;
    }
    if (step === "skills" && klass) {
      const bgSet = new Set(background?.skillProficiencies ?? []);
      const classSkills = skills.filter((s) => !bgSet.has(s));
      if (classSkills.length !== klass.skillChoices.count) return true;
      if (racialBonusSkills > 0 && bonusSkills.length !== racialBonusSkills) return true;
      if (klass.toolPicks && !validateClassToolPicks(klass.toolPicks, classToolPicks)) return true;
      if (background && !validateBackgroundToolPicks(background, bgToolPicks)) return true;
      return false;
    }
    if (step === "spells") {
      if (!spellsStepVisible) return false;
      if (chosenCantrips.length !== cantripsExpected) return true;
      if (chosenSpells.length !== spellsExpected) return true;
      if (racialCantripChoice && chosenRacialCantrip.length !== racialCantripChoice.count) return true;
      if (preparedExpected > 0 && chosenPrepared.length !== preparedExpected) return true;
      if (klass?.spellcasting) {
        const maxLv = maxCastableSpellLevel(klass.spellcasting.caster, level);
        const cid = klass.id as SpellClassId;
        for (const id of chosenSpells) {
          const sp = SPELLS.find((s) => s.id === id);
          if (!sp || sp.level < 1 || sp.level > maxLv || !sp.classes.includes(cid)) return true;
        }
        for (const id of chosenPrepared) {
          if (!chosenSpells.includes(id)) return true;
        }
      }
      return false;
    }
    if (step === "equipo") {
      if (moneyMethod === "fixed") return !equipmentChoiceComplete;
      return rolledGold == null;
    }
    if (step === "estilo" && klass && styleSlots > 0) {
      if (chosenFightingStyles.length !== styleSlots) return true;
      const allowed = new Set<string>(fightingStylesForClass(klass.id).map((s) => s.id));
      return chosenFightingStyles.some((sid) => !allowed.has(sid));
    }
    if (step === "details") {
      if (!name.trim()) return true;
      if (klass && level > 1 && hpGeneration === "rolled") {
        if (hpLevelRolls.length !== level - 1) return true;
        for (const r of hpLevelRolls) {
          if (r < 1 || r > klass.hitDie) return true;
        }
      }
      return false;
    }
    return false;
  })();

  return (
    <div>
      <Stepper
        steps={STEPS.filter((s) => !isSkipped(s.id))}
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
                setCustomAbilityPicks([]);
                setChosenFeats([]);
                setFeatAbilityChoices({});
                if (r.id !== "semielfo") setHalfElfBonus([]);
              }}
              variantId={variantId}
              onPickVariant={(id) => {
                setVariantId(id);
                setChosenLanguages([]);
                setChosenRacialCantrip([]);
                setCustomAbilityPicks([]);
                setChosenFeats([]);
                setFeatAbilityChoices({});
              }}
              halfElfBonus={halfElfBonus}
              setHalfElfBonus={setHalfElfBonus}
              customAbilityRule={customAbilityRule}
              customAbilityPicks={customAbilityPicks}
              setCustomAbilityPicks={setCustomAbilityPicks}
            />
          )}
          {step === "class" && (
            <ClassStep
              klass={klass}
              onPick={(c) => {
                setKlass(c);
                setChosenCantrips([]);
                setChosenSpells([]);
                setChosenPrepared([]);
                setChosenFightingStyles([]);
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
          {step === "feats" && (
            <FeatsStep
              slots={featSlots}
              chosen={chosenFeats}
              setChosen={(ids) => {
                setChosenFeats(ids);
                setFeatAbilityChoices((prev) => {
                  const next = { ...prev };
                  for (const id of Object.keys(next)) if (!ids.includes(id)) delete next[id];
                  return next;
                });
              }}
              abilityChoices={featAbilityChoices}
              setAbilityChoices={setFeatAbilityChoices}
              asiSlots={asiSlots}
              asiChoices={asiChoices}
              setAsiChoices={setAsiChoices}
              asiLevels={klass ? asiLevelsForClass(klass.id, level) : []}
              asiSlotPreTotals={asiSlotPreTotals}
            />
          )}
          {step === "skills" && (
            <SkillsStep
              klass={klass}
              bg={background}
              skills={skills}
              setSkills={setSkills}
              race={race}
              variant={variant}
              bonusSkills={bonusSkills}
              setBonusSkills={setBonusSkills}
              racialBonusSkills={racialBonusSkills}
              classToolPicks={classToolPicks}
              setClassToolPicks={setClassToolPicks}
              bgToolPicks={bgToolPicks}
              setBgToolPicks={setBgToolPicks}
            />
          )}
          {step === "spells" && (
            <SpellsStep
              klass={klass}
              race={race}
              variant={variant}
              characterLevel={level}
              cantripsExpected={cantripsExpected}
              spellsExpected={spellsExpected}
              preparedExpected={preparedExpected}
              racialCantripChoice={racialCantripChoice}
              chosenCantrips={chosenCantrips}
              setChosenCantrips={setChosenCantrips}
              chosenSpells={chosenSpells}
              setChosenSpells={(ids) => {
                setChosenSpells(ids);
                setChosenPrepared((prev) => prev.filter((p) => ids.includes(p)));
              }}
              chosenPrepared={chosenPrepared}
              setChosenPrepared={setChosenPrepared}
              chosenRacialCantrip={chosenRacialCantrip}
              setChosenRacialCantrip={setChosenRacialCantrip}
            />
          )}
          {step === "details" && klass && (
            <DetailsStep
              name={name}
              setName={setName}
              playerName={playerName}
              setPlayerName={setPlayerName}
              alignment={alignment}
              setAlignment={setAlignment}
              level={level}
              setLevel={setLevel}
              klass={klass}
              hpGeneration={hpGeneration}
              setHpGeneration={setHpGeneration}
              hpLevelRolls={hpLevelRolls}
              setHpLevelRolls={setHpLevelRolls}
            />
          )}
          {step === "estilo" && klass && (
            <FightingStyleStep
              klass={klass}
              styleSlots={styleSlots}
              options={fightingStylesForClass(klass.id)}
              chosen={chosenFightingStyles}
              setChosen={setChosenFightingStyles}
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
              feats={[
                ...chosenFeats,
                ...asiChoices.flatMap((c) => (c.kind === "feat" ? [c.featId] : [])),
              ]}
              fightingStyles={chosenFightingStyles}
              tools={reviewTools}
              spells={buildKnownSpells({
                chosenCantrips,
                chosenSpells,
                chosenPrepared,
                chosenRacialCantrip,
                grantedRacialCantrips: [
                  ...(race?.grantedCantrips ?? []),
                  ...(variant?.grantedCantrips ?? []),
                ],
                preparation: klass?.spellcasting?.preparation,
                preparedCaster:
                  klass?.spellcasting?.preparation === "prepared" && klass?.spellcasting
                    ? {
                        classId: klass.id as SpellClassId,
                        characterLevel: level,
                        caster: klass.spellcasting.caster,
                      }
                    : undefined,
                locale,
              })}
            />
          )}

          <div className="mt-10 flex items-center justify-between">
            <button className="btn-ghost" disabled={stepIdx === 0} onClick={goPrev}>
              {tr("wizard.prev")}
            </button>
            {step !== "review" ? (
              <button
                className="btn-accent"
                disabled={nextDisabled}
                onClick={goNext}
                title={nextDisabled ? tr("wizard.nextBlockedTitle") : undefined}
              >
                {tr("wizard.next")}
              </button>
            ) : (
              <button className="btn-accent" disabled={saving || !name || !race || !klass || !background} onClick={save}>
                {saving ? tr("wizard.saving") : tr("wizard.saveCharacter")}
              </button>
            )}
          </div>
        </div>

        <aside className="relative">
          <div className="sticky top-24 card">
            <p className="label mb-2">{tr("wizard.summaryTitle")}</p>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.name")}</dt>
              <dd>{name || tr("common.empty")}</dd>
              {playerName && (
                <>
                  <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.player")}</dt>
                  <dd>{playerName}</dd>
                </>
              )}
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.race")}</dt>
              <dd>{race ? localizedRaceBasics(race, locale).label : tr("common.empty")}
                {variant ? ` · ${variant.label}` : ""}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.class")}</dt>
              <dd>{klass ? localizedClassBasics(klass, locale).label : tr("common.empty")}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.background")}</dt>
              <dd>{background ? localizedBackgroundBasics(background, locale).label : tr("common.empty")}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.level")}</dt>
              <dd>{level}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.maxHp")}</dt>
              <dd>{maxHp || tr("common.empty")}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.ac")}</dt>
              <dd>{ac}</dd>
              <dt style={{ color: "var(--color-text-hint)" }}>{tr("wizard.summary.prof")}</dt>
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
  customAbilityRule,
  customAbilityPicks,
  setCustomAbilityPicks,
}: {
  race: RaceBasics | null;
  onPick: (r: RaceBasics) => void;
  variantId: string;
  onPickVariant: (id: string) => void;
  halfElfBonus: Ability[];
  setHalfElfBonus: (a: Ability[]) => void;
  customAbilityRule: { count: number; value: number; excludes?: Ability[] } | null;
  customAbilityPicks: Ability[];
  setCustomAbilityPicks: (a: Ability[]) => void;
}) {
  const tr = useTranslations();
  const locale = useLocale();
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
  const toggleCustom = (a: Ability) => {
    if (!customAbilityRule) return;
    if (customAbilityRule.excludes?.includes(a)) return;
    const next = new Set(customAbilityPicks);
    if (next.has(a)) next.delete(a);
    else {
      if (next.size >= customAbilityRule.count) return;
      next.add(a);
    }
    setCustomAbilityPicks(Array.from(next));
  };
  return (
    <div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {RACES.map((raw) => {
          const r = localizedRaceBasics(raw, locale);
          return (
          <button key={r.id} onClick={() => onPick(raw)} className={r.id === race?.id ? "card-accent text-left" : "card text-left"}>
            <h3 className="mb-1">{r.label}</h3>
            <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
              {tr("wizard.race.speed")} {r.speed} ·{" "}
              {Object.entries(r.abilityBonus)
                .map(([k, v]) => `${k.toUpperCase()} +${v}`)
                .join(", ")}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {r.traits.join(" · ")}
            </p>
            {r.variants && r.variants.length > 0 && (
              <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>
                {tr("wizard.race.variantsAvailable", {
                  n: r.variants.length,
                  kind: r.variantLabel?.toLowerCase() ?? tr("wizard.race.variantKind"),
                })}
              </p>
            )}
          </button>
          );
        })}
      </div>
      {race?.variants && race.variants.length > 0 && (
        <div className="mt-5 card">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">
              {tr("wizard.race.pickSubrace", {
                label: localizedRaceBasics(race, locale).variantLabel ?? tr("wizard.race.subraceDefault"),
              })}
            </p>
            <span className="badge" style={{ color: variantId ? "var(--color-accent)" : undefined }}>
              {variantId ? tr("wizard.race.selected") : tr("wizard.race.pending")}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {race.variants.map((vr) => {
              const v = localizedRaceVariant(vr, race.id, locale);
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
                      {v.speedOverride ? ` · ${tr("wizard.race.speed")} ${v.speedOverride}` : ""}
                      {v.hpBonusPerLevel ? ` · ${tr("wizard.race.hpPerLevel", { n: v.hpBonusPerLevel })}` : ""}
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
            <p className="label">{tr("wizard.race.halfElfTitle")}</p>
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
      {customAbilityRule && (
        <div className="mt-5 card">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">
              {tr("wizard.race.pickNAttributes", {
                count: customAbilityRule.count,
                pluralS: customAbilityRule.count === 1 ? "" : "s",
                pluralS2: customAbilityRule.count === 1 ? "" : "s",
                value: customAbilityRule.value,
              })}
            </p>
            <span className="badge" style={{ color: customAbilityPicks.length === customAbilityRule.count ? "var(--color-accent)" : undefined }}>
              {customAbilityPicks.length}/{customAbilityRule.count}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {(ABILITIES as readonly Ability[]).map((a) => {
              const excluded = customAbilityRule.excludes?.includes(a) ?? false;
              const checked = customAbilityPicks.includes(a);
              const disabled = excluded || (!checked && customAbilityPicks.length >= customAbilityRule.count);
              return (
                <label
                  key={a}
                  className={checked ? "card-accent flex items-center justify-between py-2" : "card flex items-center justify-between py-2"}
                  style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
                >
                  <span className="label uppercase">{a}</span>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleCustom(a)} />
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
  const tr = useTranslations();
  const locale = useLocale();
  function casterLabel(caster: NonNullable<ClassBasics["spellcasting"]>["caster"]): string {
    return tr(`wizard.class.caster.${caster}`);
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {CLASSES.map((raw) => {
        const c = localizedClassBasics(raw, locale);
        const goldExpr = `${raw.startingGoldDice.dice}d${raw.startingGoldDice.faces}${raw.startingGoldDice.multiplier > 1 ? `×${raw.startingGoldDice.multiplier}` : ""}`;
        return (
        <button key={raw.id} onClick={() => onPick(raw)} className={raw.id === klass?.id ? "card-accent text-left" : "card text-left"}>
          <div className="flex items-center justify-between">
            <h3>{c.label}</h3>
            <span className="badge">d{raw.hitDie}</span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.class.primary")}: {raw.primaryAbility.map((a) => localizedAbilityLabel(a, locale)).join("/")} · {tr("wizard.class.saves")}:{" "}
            {raw.savingThrows.map((a) => localizedAbilityLabel(a, locale)).join(", ")}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.class.skillsPick", { n: raw.skillChoices.count })} · {tr("wizard.class.startingGold", { expr: goldExpr })}
          </p>
          {raw.spellcasting && (
            <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>
              {tr("wizard.class.spellLine", {
                caster: casterLabel(raw.spellcasting.caster),
                ability: localizedAbilityLabel(raw.spellcasting.ability, locale),
              })}
            </p>
          )}
        </button>
        );
      })}
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
  const tr = useTranslations();
  const locale = useLocale();
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
        {BACKGROUNDS.map((raw) => {
          const b = localizedBackgroundBasics(raw, locale);
          return (
          <button key={raw.id} onClick={() => onPick(raw)} className={raw.id === bg?.id ? "card-accent text-left" : "card text-left"}>
            <h3>{b.label}</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
              {tr("wizard.background.skillsPrefix")}{" "}
              {raw.skillProficiencies.map((s) => localizedSkillLabel(s, locale)).join(", ")} ·{" "}
              {tr("wizard.background.gpSuffix", { n: raw.startingMoney.gp })}
              {raw.languages > 0
                ? ` · ${raw.languages === 1 ? tr("wizard.background.extraLangOne", { n: raw.languages }) : tr("wizard.background.extraLangMany", { n: raw.languages })}`
                : ""}
            </p>
            <p className="mt-2 text-sm" style={{ color: "var(--color-text-secondary)" }}>
              <strong>{b.feature.name}</strong>: {b.feature.text}
            </p>
          </button>
          );
        })}
      </div>
      {bg && extraLanguageCount > 0 && (
        <div className="mt-5 card">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">{tr("wizard.background.pickLangTitle", { n: extraLanguageCount })}</p>
            <span className="badge" style={{ color: chosenLanguages.length === extraLanguageCount ? "var(--color-accent)" : undefined }}>
              {chosenLanguages.length}/{extraLanguageCount}
            </span>
          </div>
          <p className="mb-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.background.pickLangHint")}
          </p>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {STANDARD_LANGUAGES.map((lang) => {
              const alreadyKnown = knownLanguagesSet.has(lang);
              const checked = chosenLanguages.includes(lang);
              const disabled = alreadyKnown || (!checked && chosenLanguages.length >= extraLanguageCount);
              const langDisp = displayLanguageName(lang, locale);
              return (
                <label
                  key={lang}
                  className={checked ? "card-accent flex items-center justify-between py-2" : "card flex items-center justify-between py-2"}
                  style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: alreadyKnown ? 0.45 : 1, padding: "10px 12px" }}
                >
                  <span className="text-sm">
                    {langDisp}
                    {alreadyKnown && (
                      <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        · {tr("wizard.background.alreadyKnown")}
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
  const tr = useTranslations();
  const locale = useLocale();
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
            {m === "standard" ? tr("wizard.abilities.standard") : m === "pointbuy" ? tr("wizard.abilities.pointbuy") : tr("wizard.abilities.roll")}
          </button>
        ))}
      </div>

      {method === "standard" && (
        <div>
          <p className="mb-3 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {tr("wizard.abilities.standardHelp", { values: STANDARD_ARRAY.join(", ") })}
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
              {tr("wizard.abilities.pointbuyLead")}
            </p>
            <span className="badge">{tr("wizard.abilities.pointbuySpent", { spent: pbTotal })}</span>
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
              {rolled.length ? tr("wizard.abilities.rollAgain") : tr("wizard.abilities.rollButton")}
            </button>
            <span className="text-sm" style={{ color: "var(--color-text-hint)" }}>
              {rolled.length
                ? tr("wizard.abilities.rollsLabel", { rolls: [...rolled].sort((a, b) => b - a).join(", ") })
                : tr("wizard.abilities.noRollsYet")}
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
              {tr("wizard.abilities.rollHelp")}
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
  variant,
  bonusSkills,
  setBonusSkills,
  racialBonusSkills,
  classToolPicks,
  setClassToolPicks,
  bgToolPicks,
  setBgToolPicks,
}: {
  klass: ClassBasics | null;
  bg: BackgroundBasics | null;
  skills: string[];
  setSkills: (s: string[]) => void;
  race: RaceBasics | null;
  variant: RaceVariant | null;
  bonusSkills: string[];
  setBonusSkills: (s: string[]) => void;
  racialBonusSkills: number;
  classToolPicks: string[];
  setClassToolPicks: Dispatch<SetStateAction<string[]>>;
  bgToolPicks: string[];
  setBgToolPicks: Dispatch<SetStateAction<string[]>>;
}) {
  const tr = useTranslations();
  const locale = useLocale();
  const bgSkills = new Set(bg?.skillProficiencies ?? []);
  const classList = new Set(klass?.skillChoices.from ?? []);
  const picked = new Set(skills);
  const classPicks = skills.filter((s) => !bgSkills.has(s));
  const limit = klass?.skillChoices.count ?? 0;
  const remaining = Math.max(0, limit - classPicks.length);
  const bonusSource =
    variant?.bonusSkills && race
      ? localizedRaceVariant(variant, race.id, locale).label ?? localizedRaceBasics(race, locale).label
      : race
        ? localizedRaceBasics(race, locale).label
        : "";

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
        {tr("wizard.skills.needClassBg")}
      </p>
    );
  }

  const klassUi = localizedClassBasics(klass, locale);
  const bgUi = localizedBackgroundBasics(bg, locale);

  const bonusPicksRemaining = Math.max(0, racialBonusSkills - bonusSkills.length);
  const bgToolSpecs = backgroundToolPickSpecs(bg);
  const rule = klass.toolPicks;

  function toggleClassInstrument(name: string) {
    if (!rule || rule.pool !== "instruments") return;
    setClassToolPicks((prev) => {
      if (prev.includes(name)) return prev.filter((x) => x !== name);
      if (prev.length >= rule.count) return prev;
      return [...prev, name];
    });
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {tr("wizard.skills.intro", {
            bgCount: bg.skillProficiencies.length,
            limit,
            classLabel: klassUi.label,
          })}
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
          const label = fromBg ? tr("wizard.skills.tagBackground") : inClass ? tr("wizard.skills.tagClass") : tr("wizard.skills.tagUnavailable");
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
                <p className="text-sm">{localizedSkillLabel(key, locale)}</p>
                <p className="text-xs" style={{ color }}>
                  {localizedAbilityLabel(s.ability, locale)} · {label}
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
              {tr("wizard.skills.racialIntro", { source: bonusSource, n: racialBonusSkills })}
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
                    <p className="text-sm">{localizedSkillLabel(key, locale)}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {localizedAbilityLabel(s.ability, locale)}
                      {alreadyChosen ? ` · ${tr("wizard.skills.racialTaken")}` : ` · ${tr("wizard.skills.racialPool")}`}
                    </p>
                  </div>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleBonus(key)} />
                </label>
              );
            })}
          </div>
        </div>
      )}

      {(rule || bgToolSpecs.length > 0) && (
        <div className="mt-8 space-y-6">
          <p className="label">{tr("wizard.skills.toolsTitle")}</p>
          {rule?.pool === "instruments" && (
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {tr("wizard.skills.instrumentsPick", { classLabel: klassUi.label, count: rule.count })}
                </p>
                <span className="badge" style={{ color: classToolPicks.length === rule.count ? "var(--color-accent)" : undefined }}>
                  {classToolPicks.length}/{rule.count}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {toolsInPool("instruments").map((inst) => {
                  const checked = classToolPicks.includes(inst);
                  const disabled = !checked && classToolPicks.length >= rule.count;
                  return (
                    <label
                      key={inst}
                      className={checked ? "card-accent flex items-center justify-between py-2" : "card flex items-center justify-between py-2"}
                      style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1 }}
                    >
                      <span className="text-sm">{localizeGamePhrase(inst, locale)}</span>
                      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleClassInstrument(inst)} />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {rule?.pool === "artisan-or-instrument" && (
            <div className="card">
              <label className="block">
                <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  {tr("wizard.skills.artisanOrInstrument", { classLabel: klassUi.label })}
                </span>
                <select
                  className="input mt-2 w-full max-w-md"
                  value={classToolPicks[0] ?? ""}
                  onChange={(e) => setClassToolPicks(e.target.value ? [e.target.value] : [])}
                >
                  <option value="">{tr("wizard.skills.choosePlaceholder")}</option>
                  {toolsInPool("artisan-or-instrument").map((t) => (
                    <option key={t} value={t}>
                      {localizeGamePhrase(t, locale)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {bgToolSpecs.length > 0 && (
            <div className="card space-y-4">
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {tr("wizard.skills.bgToolsTitle", { label: bgUi.label })}
              </p>
              {bgToolSpecs.map((spec, i) => (
                <label key={`${bg.id}-tool-${i}`} className="block">
                  <span className="label">{tr("wizard.skills.bgToolsChoice", { n: i + 1 })}</span>
                  <select
                    className="input mt-2 w-full max-w-md"
                    value={bgToolPicks[i] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBgToolPicks((prev) => {
                        const next = [...prev];
                        while (next.length < bgToolSpecs.length) next.push("");
                        next[i] = v;
                        return next.slice(0, bgToolSpecs.length);
                      });
                    }}
                  >
                    <option value="">{tr("wizard.skills.choosePlaceholder")}</option>
                    {toolsInPool(spec.pool).map((t) => (
                      <option key={t} value={t}>
                        {localizeGamePhrase(t, locale)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
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
  klass,
  hpGeneration,
  setHpGeneration,
  hpLevelRolls,
  setHpLevelRolls,
}: {
  name: string;
  setName: (v: string) => void;
  playerName: string;
  setPlayerName: (v: string) => void;
  alignment: string;
  setAlignment: (v: string) => void;
  level: number;
  setLevel: (v: number) => void;
  klass: ClassBasics;
  hpGeneration: "average" | "rolled";
  setHpGeneration: (m: "average" | "rolled") => void;
  hpLevelRolls: number[];
  setHpLevelRolls: Dispatch<SetStateAction<number[]>>;
}) {
  const tr = useTranslations();
  const hd = klass.hitDie;
  function rollOne(idx: number) {
    const v = Math.floor(Math.random() * hd) + 1;
    setHpLevelRolls((prev) => {
      const next = [...prev];
      next[idx] = v;
      return next;
    });
  }
  function setRoll(idx: number, raw: string) {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return;
    const clamped = Math.max(1, Math.min(hd, n));
    setHpLevelRolls((prev) => {
      const next = [...prev];
      next[idx] = clamped;
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label">{tr("wizard.details.characterName")}</span>
          <input className="input mt-2" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Arannis Soldrake" />
        </label>
        <label className="block">
          <span className="label">{tr("wizard.details.playerName")}</span>
          <input
            className="input mt-2"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Ej: María López"
          />
        </label>
        <label className="block">
          <span className="label">{tr("wizard.details.level")}</span>
          <input className="input mt-2" type="number" min={1} max={20} value={level} onChange={(e) => setLevel(Number(e.target.value))} />
        </label>
        <label className="block">
          <span className="label">{tr("wizard.details.alignment")}</span>
          <select className="input mt-2" value={alignment} onChange={(e) => setAlignment(e.target.value)}>
            {ALIGNMENT_CODES.map((code) => (
              <option key={code} value={code}>
                {tr(`wizard.alignment.${code}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {level > 1 && (
        <div className="card">
          <p className="label mb-2">{tr("wizard.details.hpTitle")}</p>
          <p className="mb-4 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.details.hpHint", { hd })}
          </p>
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              className={hpGeneration === "average" ? "btn-accent" : "btn-ghost"}
              onClick={() => setHpGeneration("average")}
            >
              {tr("wizard.details.hpAverage")}
            </button>
            <button type="button" className={hpGeneration === "rolled" ? "btn-accent" : "btn-ghost"} onClick={() => setHpGeneration("rolled")}>
              {tr("wizard.details.hpRolled")}
            </button>
          </div>
          {hpGeneration === "rolled" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {hpLevelRolls.map((roll, i) => (
                <div key={i} className="card flex flex-col gap-2 py-3">
                  <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {tr("wizard.details.levelUpRoll", { n: i + 2, hd })}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      className="input w-20 text-center"
                      min={1}
                      max={hd}
                      value={roll}
                      onChange={(e) => setRoll(i, e.target.value)}
                    />
                    <button type="button" className="btn-ghost text-sm" onClick={() => rollOne(i)}>
                      {tr("wizard.details.rollOnce")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FightingStyleStep({
  klass,
  styleSlots,
  options,
  chosen,
  setChosen,
}: {
  klass: ClassBasics;
  styleSlots: number;
  options: FightingStyle[];
  chosen: string[];
  setChosen: (ids: string[]) => void;
}) {
  const tr = useTranslations();
  const locale = useLocale();
  function pick(id: string) {
    if (styleSlots <= 1) {
      setChosen(chosen[0] === id ? [] : [id]);
      return;
    }
    const set = new Set(chosen);
    if (set.has(id)) set.delete(id);
    else if (chosen.length < styleSlots) set.add(id);
    setChosen(Array.from(set));
  }

  const klassUi = localizedClassBasics(klass, locale);
  const phrase =
    styleSlots === 1 ? tr("wizard.fightingStyle.oneStyle") : tr("wizard.fightingStyle.nStyles", { n: styleSlots });

  return (
    <div>
      <p className="mb-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
        {tr("wizard.fightingStyle.intro", { label: klassUi.label, phrase })}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {options.map((raw) => {
          const s = localizedFightingStyle(raw, locale);
          const active = chosen.includes(s.id);
          return (
            <button key={s.id} type="button" onClick={() => pick(s.id)} className={active ? "card-accent text-left" : "card text-left"}>
              <h3>{s.label}</h3>
              <p className="mt-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                {s.summary}
              </p>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs" style={{ color: "var(--color-text-hint)" }}>
        {tr("wizard.fightingStyle.footer", { n: styleSlots })}
      </p>
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
  const tr = useTranslations();
  const locale = useLocale();
  if (!klass || !background) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
        {tr("wizard.equipment.needClassBg")}
      </p>
    );
  }

  const bgUi = localizedBackgroundBasics(background, locale);

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
          {tr("wizard.equipment.takeClass")}
        </button>
        <button
          className={moneyMethod === "rolled" ? "btn-accent" : "btn-ghost"}
          onClick={() => setMoneyMethod("rolled")}
        >
          {tr("wizard.equipment.rollGold", { expr: goldExpr })}
        </button>
      </div>

      <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
        {moneyMethod === "fixed"
          ? tr("wizard.equipment.fixedBlurb", { label: bgUi.label })
          : tr("wizard.equipment.rolledBlurb", { label: bgUi.label })}
      </p>

      {moneyMethod === "fixed" && (
        <div className="space-y-4">
          {klass.startingEquipmentFixed.length > 0 && (
            <div className="card">
              <p className="label mb-2">{tr("wizard.equipment.guaranteedTitle")}</p>
              <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
                {klass.startingEquipmentFixed.map((it, i) => (
                  <li key={i}>
                    {it.qty > 1 ? `${it.qty}× ` : ""}
                    {localizeGamePhrase(it.name, locale)}
                    {it.note && (
                      <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        · {localizeGamePhrase(it.note, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {klass.startingEquipmentChoices.map((choice) => (
            <div key={choice.id} className="card">
              <p className="label mb-2">{localizeGamePhrase(choice.label, locale)}</p>
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
                      <p className="text-sm">{localizeGamePhrase(opt.label, locale)}</p>
                      <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        {opt.items
                          .slice(0, 6)
                          .map((it) =>
                            it.qty > 1
                              ? `${it.qty}× ${localizeGamePhrase(it.name, locale)}`
                              : localizeGamePhrase(it.name, locale),
                          )
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
            <p className="label mb-2">{tr("wizard.equipment.goldRollTitle", { expr: goldExpr })}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="btn-accent" onClick={rollGold}>
                {rolledGold == null ? tr("wizard.equipment.rollDice") : tr("wizard.equipment.rollAgain")}
              </button>
              {rolledGold != null && (
                <div>
                  <p className="text-sm">
                    <strong>{localizeGamePhrase(`${rolledGold} po`, locale)}</strong>
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                    {tr("wizard.equipment.goldRollsLine", {
                      rolls: goldRolls.join(", "),
                      mult: klass.startingGoldDice.multiplier > 1 ? ` × ${klass.startingGoldDice.multiplier}` : "",
                    })}
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
              <p className="text-sm">{tr("wizard.equipment.keepBgGear")}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                {tr("wizard.equipment.keepBgHint", { label: bgUi.label })}
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
        <p className="label mb-2">{tr("wizard.equipment.bgPackTitle", { label: bgUi.label })}</p>
        <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
          {background.equipment.map((name, i) => (
            <li key={i}>{localizeGamePhrase(name, locale)}</li>
          ))}
          <li>
            <span style={{ color: "var(--color-accent)" }}>
              {tr("wizard.equipment.bgGoldLine", { n: background.startingMoney.gp })}
            </span>
          </li>
        </ul>
        {moneyMethod === "rolled" && !keepBgEquipmentOnRoll && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-accent)" }}>
            {tr("wizard.equipment.houseRuleWarn")}
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
  feats,
  fightingStyles,
  tools,
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
  feats: string[];
  fightingStyles: string[];
  tools: string[];
  spells: { name: string; level: number; prepared: boolean }[];
}) {
  const tr = useTranslations();
  const locale = useLocale();
  const fightingStyleRecords = fightingStyles
    .map((fid) => FIGHTING_STYLES.find((st) => st.id === fid))
    .filter((st): st is FightingStyle => st != null)
    .map((st) => localizedFightingStyle(st, locale));
  const featRecords = feats
    .map((id) => FEATS.find((f) => f.id === id))
    .filter((f): f is Feat => f != null);
  const raceDisp = race ? localizedRaceBasics(race, locale).label : "?";
  const klassDisp = klass ? localizedClassBasics(klass, locale).label : "?";
  const bgDisp = background ? localizedBackgroundBasics(background, locale).label : "?";

  return (
    <div className="space-y-4">
      <div className="card">
        <h2 className="mb-1">{name || tr("wizard.review.unnamed")}</h2>
        {playerName && (
          <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.review.playerPrefix")} {playerName}
          </p>
        )}
        <p className="mt-2" style={{ color: "var(--color-text-secondary)" }}>
          {tr("wizard.review.lineage", {
            race: raceDisp,
            klass: klassDisp,
            level,
            alignment: alignmentLabel(alignment, tr),
            background: bgDisp,
          })}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label={tr("wizard.review.maxHp")} value={maxHp} />
          <Stat label={tr("wizard.review.ac")} value={ac} />
          <Stat label={tr("wizard.review.prof")} value={`+${prof}`} />
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
        <p className="label mb-2">{tr("wizard.review.profSkills")}</p>
        <p className="text-sm">
          {skills.length ? skills.map((k) => localizedSkillLabel(k, locale)).join(", ") : tr("wizard.review.none")}
        </p>
      </div>

      <div className="card">
        <p className="label mb-2">{tr("wizard.review.languages")}</p>
        <p className="text-sm">
          {languages.length ? languages.map((l) => displayLanguageName(l, locale)).join(", ") : "—"}
        </p>
      </div>

      {tools.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("wizard.review.tools")}</p>
          <p className="text-sm">{tools.map((t) => localizeGamePhrase(t, locale)).join(", ")}</p>
        </div>
      )}

      {fightingStyleRecords.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("wizard.review.fightingStyles")}</p>
          <ul className="space-y-3 text-sm">
            {fightingStyleRecords.map((s) => (
              <li key={s.id}>
                <p>
                  <strong>{s.label}</strong>
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {s.summary}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {featRecords.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("wizard.review.feats")}</p>
          <ul className="space-y-3 text-sm">
            {featRecords.map((f) => {
              const fd = featForLocale(f, locale);
              return (
                <li key={f.id}>
                  <p>
                    <strong>{fd.name}</strong>
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {fd.summary}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {spells.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("wizard.review.spellsTitle")}</p>
          <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            {spells.map((s, i) => (
              <li key={i}>
                <span style={{ color: "var(--color-accent)" }}>
                  {s.level === 0 ? tr("wizard.spells.cantripBadge") : tr("wizard.spells.levelBadge", { n: s.level })}
                </span>{" "}
                · {s.name}
                {!s.prepared && s.level > 0 && (
                  <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                    ·{" "}
                    {klass?.spellcasting?.preparation === "spellbook"
                      ? tr("wizard.review.spellbookNote")
                      : tr("wizard.review.unpreparedNote")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <p className="label mb-2">{tr("wizard.review.equipmentTitle")}</p>
        {equipment.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.review.noEquipment")}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            {equipment.map((it, i) => (
              <li key={i}>
                {it.qty > 1 ? `${it.qty}× ` : ""}
                {localizeGamePhrase(it.name, locale)}
                {it.note && (
                  <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                    · {localizeGamePhrase(it.note, locale)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm">
          <strong>{tr("wizard.review.startingGold")}</strong> {localizeGamePhrase(`${money.gp} po`, locale)}
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
  characterLevel,
  cantripsExpected,
  spellsExpected,
  preparedExpected,
  racialCantripChoice,
  chosenCantrips,
  setChosenCantrips,
  chosenSpells,
  setChosenSpells,
  chosenPrepared,
  setChosenPrepared,
  chosenRacialCantrip,
  setChosenRacialCantrip,
}: {
  klass: ClassBasics | null;
  race: RaceBasics | null;
  variant: RaceVariant | null;
  characterLevel: number;
  cantripsExpected: number;
  spellsExpected: number;
  preparedExpected: number;
  racialCantripChoice: { fromClass: string; ability: Ability; count: number } | null;
  chosenCantrips: string[];
  setChosenCantrips: (s: string[]) => void;
  chosenSpells: string[];
  setChosenSpells: (s: string[]) => void;
  chosenPrepared: string[];
  setChosenPrepared: (s: string[]) => void;
  chosenRacialCantrip: string[];
  setChosenRacialCantrip: (s: string[]) => void;
}) {
  const tr = useTranslations();
  const locale = useLocale();
  const classId = (klass?.id ?? "") as SpellClassId;
  const maxSpellLv = klass?.spellcasting ? maxCastableSpellLevel(klass.spellcasting.caster, characterLevel) : 1;

  function localizedSpellClassName(classIdStr: string): string {
    const raw = CLASSES.find((c) => c.id === classIdStr);
    return raw ? localizedClassBasics(raw, locale).label : classIdStr;
  }

  const classCantrips = useMemo<Spell[]>(
    () => (classId ? spellsForClassAtLevel(classId, 0).map((s) => spellForLocale(s, locale)) : []),
    [classId, locale],
  );
  const spellbookPreview = useMemo(() => {
    return chosenSpells
      .map((id) => SPELLS.find((s) => s.id === id))
      .filter((s): s is Spell => s != null)
      .map((s) => spellForLocale(s, locale))
      .sort((a, b) =>
        a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name, spellSortLocale(locale)),
      );
  }, [chosenSpells, locale]);
  const racialPool = useMemo<Spell[]>(() => {
    if (!racialCantripChoice) return [];
    return spellsForClassAtLevel(racialCantripChoice.fromClass as SpellClassId, 0).map((s) => spellForLocale(s, locale));
  }, [racialCantripChoice, locale]);

  const grantedRacial: { spell: Spell; ability: Ability; source: string }[] = useMemo(() => {
    const grants = [...(race?.grantedCantrips ?? []), ...(variant?.grantedCantrips ?? [])];
    const srcLabel =
      variant && race
        ? localizedRaceVariant(variant, race.id, locale).label ?? localizedRaceBasics(race, locale).label
        : race
          ? localizedRaceBasics(race, locale).label
          : "";
    return grants
      .map((g) => {
        const spell = SPELLS.find((s) => s.id === g.spellId);
        if (!spell) return null;
        return { spell: spellForLocale(spell, locale), ability: g.ability, source: srcLabel };
      })
      .filter((x): x is { spell: Spell; ability: Ability; source: string } => x != null);
  }, [race, variant, locale]);

  const toggleFrom = (list: string[], setList: (v: string[]) => void, max: number, id: string) => {
    const set = new Set(list);
    if (set.has(id)) set.delete(id);
    else {
      if (set.size >= max) return;
      set.add(id);
    }
    setList(Array.from(set));
  };

  function toggleLeveledSpell(id: string) {
    const sp = SPELLS.find((s) => s.id === id);
    if (sp && sp.level > maxSpellLv) return;
    toggleFrom(chosenSpells, setChosenSpells, spellsExpected, id);
  }

  const preparation = klass?.spellcasting?.preparation;
  const spellsAbility = klass?.spellcasting?.ability;
  const klassUi = klass ? localizedClassBasics(klass, locale) : null;
  const spellsLabel =
    preparation === "spellbook"
      ? tr("wizard.spells.labelSpellbook", { n: spellsExpected, maxLv: maxSpellLv })
      : preparation === "prepared" && spellsAbility
        ? tr("wizard.spells.labelPrepared", { maxLv: maxSpellLv, n: spellsExpected })
        : tr("wizard.spells.labelKnown", { maxLv: maxSpellLv, n: spellsExpected });

  const introText = klass?.spellcasting
    ? tr("wizard.spells.introKnown", {
        classLower: klassUi?.label.toLowerCase() ?? "",
        level: characterLevel,
      })
    : tr("wizard.spells.introRacial");
  const cantripsHeader = klass?.spellcasting
    ? tr("wizard.spells.cantripsOfClass", {
        classLower: klassUi?.label.toLowerCase() ?? "",
        n: cantripsExpected,
      })
    : tr("wizard.spells.cantripsGeneric", { n: cantripsExpected });

  return (
    <div className="space-y-6">
      <div className="card">
        <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
          {introText}
          {preparation === "prepared" && tr("wizard.spells.preparedLongRest")}
          {preparation === "spellbook" && tr("wizard.spells.spellbookPrepHint")}
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
            locale={locale}
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
          <p className="mb-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.spells.maxSlotHint", { maxLv: maxSpellLv })}
          </p>
          {Array.from({ length: maxSpellLv }, (_, i) => i + 1).map((lv) => {
            const row = classId ? spellsForClassAtLevel(classId, lv).map((s) => spellForLocale(s, locale)) : [];
            if (row.length === 0) return null;
            return (
              <div key={lv} className="mb-5">
                <p className="mb-2 text-xs uppercase" style={{ color: "var(--color-text-hint)", letterSpacing: "0.06em" }}>
                  {tr("wizard.spells.levelHeader", { n: lv })}
                </p>
                <SpellGrid
                  spells={row}
                  selected={chosenSpells}
                  onToggle={toggleLeveledSpell}
                  max={spellsExpected}
                  locale={locale}
                />
              </div>
            );
          })}
        </div>
      )}

      {preparation === "spellbook" && preparedExpected > 0 && chosenSpells.length === spellsExpected && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">
              {tr("wizard.spells.preparedToday", {
                ability: spellsAbility ? localizedAbilityLabel(spellsAbility, locale) : "INT",
                n: preparedExpected,
              })}
            </p>
            <span className="badge" style={{ color: chosenPrepared.length === preparedExpected ? "var(--color-accent)" : undefined }}>
              {chosenPrepared.length}/{preparedExpected}
            </span>
          </div>
          <p className="mb-3 text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("wizard.spells.spellbookRestHint")}
          </p>
          <SpellGrid
            spells={spellbookPreview}
            selected={chosenPrepared}
            onToggle={(id) => toggleFrom(chosenPrepared, setChosenPrepared, preparedExpected, id)}
            max={preparedExpected}
            locale={locale}
          />
        </div>
      )}

      {racialCantripChoice && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">
              {tr("wizard.spells.racialCantrip", {
                source:
                  variant && race
                    ? localizedRaceVariant(variant, race.id, locale).label ?? localizedRaceBasics(race, locale).label
                    : race
                      ? localizedRaceBasics(race, locale).label
                      : "",
                count: racialCantripChoice.count,
                fromClass: localizedSpellClassName(racialCantripChoice.fromClass),
                ability: localizedAbilityLabel(racialCantripChoice.ability, locale),
              })}
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
            locale={locale}
          />
        </div>
      )}

      {grantedRacial.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("wizard.spells.grantedCantripsTitle")}</p>
          <ul className="space-y-1 text-sm">
            {grantedRacial.map((g) => (
              <li key={g.spell.id}>
                <strong>{g.spell.name}</strong>{" "}
                <span style={{ color: "var(--color-text-hint)" }}>
                  · {g.source} · {localizedAbilityLabel(g.ability, locale)} · {g.spell.description}
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
  locale,
}: {
  spells: Spell[];
  selected: string[];
  onToggle: (id: string) => void;
  max: number;
  locale: ReturnType<typeof useLocale>;
}) {
  const tr = useTranslations();
  if (spells.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-text-hint)" }}>
        {tr("wizard.spells.noneAvailable")}
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
          localizedSpellSchool(s.school, locale),
          s.ritual ? tr("wizard.spells.tagRitual") : null,
          s.concentration ? tr("wizard.spells.tagConc") : null,
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

function FeatsStep({
  slots,
  chosen,
  setChosen,
  abilityChoices,
  setAbilityChoices,
  asiSlots,
  asiChoices,
  setAsiChoices,
  asiLevels,
  asiSlotPreTotals,
}: {
  slots: number;
  chosen: string[];
  setChosen: (ids: string[]) => void;
  abilityChoices: Record<string, Ability>;
  setAbilityChoices: (v: Record<string, Ability>) => void;
  asiSlots: number;
  asiChoices: AsiChoice[];
  setAsiChoices: (v: AsiChoice[] | ((prev: AsiChoice[]) => AsiChoice[])) => void;
  asiLevels: number[];
  asiSlotPreTotals: Record<Ability, number>[];
}) {
  const tr = useTranslations();
  const toggle = (id: string) => {
    const next = new Set(chosen);
    if (next.has(id)) next.delete(id);
    else {
      if (next.size >= slots) return;
      next.add(id);
    }
    setChosen(Array.from(next));
  };
  const pickAbility = (featId: string, ab: Ability) => {
    setAbilityChoices({ ...abilityChoices, [featId]: ab });
  };
  const full = chosen.length >= slots;
  const reservedFeatIds = new Set(asiChoices.flatMap((c) => (c.kind === "feat" ? [c.featId] : [])));
  const usedRacialFeatIds = new Set(chosen);

  const updateAsi = (idx: number, next: AsiChoice) => {
    setAsiChoices((prev) => {
      const copy = [...prev];
      copy[idx] = next;
      return copy;
    });
  };
  return (
    <div className="space-y-8">
      {slots > 0 && (
        <section className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {tr("wizard.feats.racialIntro", { slots })}
              </p>
              <span className="badge" style={{ color: full ? "var(--color-accent)" : undefined }}>
                {chosen.length}/{slots}
              </span>
            </div>
          </div>
          <FeatList
            title={tr("wizard.feats.racialTitle")}
            selectedIds={chosen}
            disabledIds={reservedFeatIds}
            onToggle={toggle}
            full={full}
            abilityChoices={abilityChoices}
            pickAbility={pickAbility}
          />
        </section>
      )}

      {asiSlots > 0 && (
        <section className="space-y-4">
          <div className="card">
            <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
              {tr("wizard.feats.asiIntro", { slots: asiSlots, levels: asiLevels.join(", ") })}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {asiChoices.map((choice, idx) => (
              <AsiSlot
                key={idx}
                idx={idx}
                level={asiLevels[idx]}
                value={choice}
                onChange={(next) => updateAsi(idx, next)}
                reservedRacial={usedRacialFeatIds}
                reservedOtherSlots={
                  new Set(
                    asiChoices
                      .filter((_, i) => i !== idx)
                      .flatMap((c) => (c.kind === "feat" ? [c.featId] : [])),
                  )
                }
                preTotals={asiSlotPreTotals[idx]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FeatList({
  title,
  selectedIds,
  disabledIds,
  onToggle,
  full,
  abilityChoices,
  pickAbility,
}: {
  title: string;
  selectedIds: string[];
  disabledIds: Set<string>;
  onToggle: (id: string) => void;
  full: boolean;
  abilityChoices: Record<string, Ability>;
  pickAbility: (featId: string, ab: Ability) => void;
}) {
  const tr = useTranslations();
  const locale = useLocale();
  return (
    <div>
      <p className="label mb-3">{title}</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FEATS.map((feat) => {
          const fd = featForLocale(feat, locale);
          const picked = selectedIds.includes(feat.id);
          const reservedElsewhere = !picked && disabledIds.has(feat.id);
          const disabled = reservedElsewhere || (!picked && full);
          const needsAbilityChoice = feat.abilityBonus && feat.abilityBonus.from.length > 1;
          const chosenAbility = abilityChoices[feat.id];
          return (
            <div
              key={feat.id}
              className={picked ? "card-accent" : "card"}
              style={{ opacity: disabled ? 0.55 : 1, padding: "14px 16px" }}
            >
              <label
                className="flex items-start justify-between gap-3"
                style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              >
                <div className="flex-1">
                  <p className="text-sm">
                    <strong>{fd.name}</strong>
                    {fd.prerequisite && (
                      <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        {tr("wizard.feats.req")} {fd.prerequisite}
                      </span>
                    )}
                    {reservedElsewhere && (
                      <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        · {tr("wizard.feats.reservedOther")}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {fd.summary}
                  </p>
                </div>
                <input type="checkbox" checked={picked} disabled={disabled} onChange={() => onToggle(feat.id)} />
              </label>
              {picked && (
                <ul className="mt-3 space-y-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                  {fd.grants.map((line, i) => (
                    <li key={i}>· {line}</li>
                  ))}
                </ul>
              )}
              {picked && needsAbilityChoice && feat.abilityBonus && (
                <div className="mt-3">
                  <p className="label mb-2">{tr("wizard.feats.pickAbility", { n: feat.abilityBonus.value })}</p>
                  <div className="flex flex-wrap gap-2">
                    {feat.abilityBonus.from.map((ab) => (
                      <button
                        key={ab}
                        onClick={() => pickAbility(feat.id, ab)}
                        className={chosenAbility === ab ? "btn-accent" : "btn-ghost"}
                        style={{ padding: "4px 10px", fontSize: 12 }}
                      >
                        {localizedAbilityLabel(ab, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AsiSlot({
  idx,
  level,
  value,
  onChange,
  reservedRacial,
  reservedOtherSlots,
  preTotals,
}: {
  idx: number;
  level?: number;
  value: AsiChoice;
  onChange: (next: AsiChoice) => void;
  reservedRacial: Set<string>;
  reservedOtherSlots: Set<string>;
  preTotals: Record<Ability, number>;
}) {
  const tr = useTranslations();
  const locale = useLocale();
  const ABILITY_CAP = 20;
  // Dado un estado de `picks` propuesto, convierte a contribución por atributo siguiendo
  // la misma regla que `racialBonus` (1 pick → +2; 2 picks distintos → +1 cada uno).
  const picksContribution = (picks: Ability[]): Record<Ability, number> => {
    const c: Record<Ability, number> = { fue: 0, des: 0, con: 0, int: 0, sab: 0, car: 0 };
    if (picks.length === 1) c[picks[0]] += 2;
    else if (picks.length === 2) {
      c[picks[0]] += 1;
      c[picks[1]] += 1;
    }
    return c;
  };
  const wouldExceedCap = (contrib: Record<Ability, number>): boolean => {
    for (const ab of ABILITIES) {
      if ((preTotals?.[ab] ?? 0) + contrib[ab] > ABILITY_CAP) return true;
    }
    return false;
  };
  const computeNextPicks = (picks: Ability[], ab: Ability): Ability[] => {
    if (picks.length === 1 && picks[0] === ab) return [];
    if (picks.length === 2 && picks.includes(ab)) return picks.filter((p) => p !== ab);
    if (picks.length === 0) return [ab];
    if (picks.length === 1) return picks[0] === ab ? [ab, ab] : [picks[0], ab];
    return [picks[1], ab];
  };
  const abilityButtonBlocked = (ab: Ability): boolean => {
    if (value.kind !== "asi") return false;
    const next = computeNextPicks(value.picks, ab);
    const nextContrib = picksContribution(next);
    const currContrib = picksContribution(value.picks);
    // Sólo bloquear si la nueva selección INCREMENTA la contribución al algún atributo
    // capado; permitir siempre "quitar" (decrementar) aunque el estado actual ya exceda.
    for (const a of ABILITIES) {
      if (nextContrib[a] > currContrib[a] && (preTotals?.[a] ?? 0) + nextContrib[a] > ABILITY_CAP) {
        return true;
      }
    }
    return false;
  };

  const setKind = (kind: "asi" | "feat") => {
    if (kind === "asi") onChange({ kind: "asi", picks: [] });
    else onChange({ kind: "feat", featId: "" });
  };
  const toggleAsiPick = (ab: Ability) => {
    if (value.kind !== "asi") return;
    if (abilityButtonBlocked(ab)) return;
    const picks = value.picks;
    if (picks.length === 1 && picks[0] === ab) {
      onChange({ kind: "asi", picks: [] });
      return;
    }
    if (picks.length === 2 && picks.includes(ab)) {
      onChange({ kind: "asi", picks: picks.filter((p) => p !== ab) });
      return;
    }
    if (picks.length === 0) {
      onChange({ kind: "asi", picks: [ab] });
      return;
    }
    if (picks.length === 1) {
      if (picks[0] === ab) onChange({ kind: "asi", picks: [ab, ab] });
      else onChange({ kind: "asi", picks: [picks[0], ab] });
      return;
    }
    onChange({ kind: "asi", picks: [picks[1], ab] });
  };
  const canUpgradeSingleToDouble =
    value.kind === "asi" &&
    value.picks.length === 1 &&
    (preTotals?.[value.picks[0]] ?? 0) + 2 <= ABILITY_CAP;
  const upgradeSingleToDouble = () => {
    if (value.kind !== "asi" || value.picks.length !== 1) return;
    if (!canUpgradeSingleToDouble) return;
    onChange({ kind: "asi", picks: [value.picks[0], value.picks[0]] });
  };
  const pickFeat = (featId: string) => {
    onChange({ kind: "feat", featId, abilityChoice: undefined });
  };
  const pickFeatAbility = (ab: Ability) => {
    if (value.kind !== "feat") return;
    onChange({ ...value, abilityChoice: ab });
  };
  // Un dote queda bloqueado si todas sus opciones de +ASI empujarían algún atributo por encima de 20.
  const featBlockedByCap = (feat: Feat): boolean => {
    if (!feat.abilityBonus) return false;
    const options = feat.abilityBonus.from;
    return options.every((ab) => (preTotals?.[ab] ?? 0) + feat.abilityBonus!.value > ABILITY_CAP);
  };

  const asiSummary =
    value.kind === "asi"
      ? value.picks.length === 0
        ? tr("wizard.asi.summaryEmpty")
        : value.picks.length === 1
        ? tr("wizard.asi.summaryPlusOneDup", { a: localizedAbilityLabel(value.picks[0], locale) })
        : value.picks[0] === value.picks[1]
        ? tr("wizard.asi.summaryPlusTwo", { a: localizedAbilityLabel(value.picks[0], locale) })
        : tr("wizard.asi.summarySplit", {
            a: localizedAbilityLabel(value.picks[0], locale),
            b: localizedAbilityLabel(value.picks[1], locale),
          })
      : "";

  return (
    <div className="card" style={{ padding: "16px 18px" }}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm">
          <strong>{tr("wizard.asi.slotTitle", { n: idx + 1 })}</strong>
          {typeof level === "number" && (
            <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
              · {tr("wizard.asi.levelTag", { n: level })}
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setKind("asi")}
            className={value.kind === "asi" ? "btn-accent" : "btn-ghost"}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            {tr("wizard.asi.raiseAbilities")}
          </button>
          <button
            onClick={() => setKind("feat")}
            className={value.kind === "feat" ? "btn-accent" : "btn-ghost"}
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            {tr("wizard.asi.feat")}
          </button>
        </div>
      </div>

      {value.kind === "none" && (
        <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
          {tr("wizard.asi.chooseKind")}
        </p>
      )}

      {value.kind === "asi" && (
        <div>
          <p className="label mb-2">{tr("wizard.asi.pickOneOrTwo")}</p>
          <div className="flex flex-wrap gap-2">
            {ABILITIES.map((ab) => {
              const count = value.picks.filter((p) => p === ab).length;
              const blocked = abilityButtonBlocked(ab);
              const atCap = (preTotals?.[ab] ?? 0) >= ABILITY_CAP;
              const lab = localizedAbilityLabel(ab, locale);
              return (
                <button
                  key={ab}
                  onClick={() => toggleAsiPick(ab)}
                  disabled={blocked}
                  className={count > 0 ? "btn-accent" : "btn-ghost"}
                  style={{ padding: "4px 10px", fontSize: 12, opacity: blocked ? 0.5 : 1 }}
                  title={
                    blocked
                      ? atCap
                        ? tr("wizard.asi.capAt20", { label: lab })
                        : tr("wizard.asi.wouldExceed", { label: lab })
                      : undefined
                  }
                >
                  {lab}
                  {count > 0 && <span className="ml-1">+{count}</span>}
                </button>
              );
            })}
          </div>
          {value.picks.length === 1 && (
            <button
              onClick={upgradeSingleToDouble}
              disabled={!canUpgradeSingleToDouble}
              className="btn-ghost mt-3"
              style={{ padding: "4px 10px", fontSize: 12, opacity: canUpgradeSingleToDouble ? 1 : 0.5 }}
              title={
                canUpgradeSingleToDouble
                  ? undefined
                  : tr("wizard.asi.wouldExceedDup", { label: localizedAbilityLabel(value.picks[0], locale) })
              }
            >
              {tr("wizard.asi.duplicateForTwo", { label: localizedAbilityLabel(value.picks[0], locale) })}
            </button>
          )}
          <p className="mt-3 text-xs" style={{ color: "var(--color-text-secondary)" }}>
            {asiSummary}
          </p>
        </div>
      )}

      {value.kind === "feat" && (
        <div>
          <p className="label mb-2">{tr("wizard.asi.pickFeat")}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {FEATS.map((feat) => {
              const fd = featForLocale(feat, locale);
              const reservedAsRacial = reservedRacial.has(feat.id);
              const reservedElsewhere = reservedOtherSlots.has(feat.id);
              const picked = value.featId === feat.id;
              const capBlocked = !picked && featBlockedByCap(feat);
              const disabled = !picked && (reservedAsRacial || reservedElsewhere || capBlocked);
              const needsAbilityChoice = feat.abilityBonus && feat.abilityBonus.from.length > 1;
              return (
                <div
                  key={feat.id}
                  className={picked ? "card-accent" : "card"}
                  style={{ opacity: disabled ? 0.55 : 1, padding: "12px 14px" }}
                >
                  <label
                    className="flex items-start justify-between gap-3"
                    style={{ cursor: disabled ? "not-allowed" : "pointer" }}
                    title={
                      capBlocked
                        ? tr("wizard.asi.featBonusBlocked", { n: feat.abilityBonus?.value ?? 0 })
                        : undefined
                    }
                  >
                    <div className="flex-1">
                      <p className="text-sm">
                        <strong>{fd.name}</strong>
                        {fd.prerequisite && (
                          <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                            {tr("wizard.feats.req")} {fd.prerequisite}
                          </span>
                        )}
                        {(reservedAsRacial || reservedElsewhere) && (
                          <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                            · {tr("wizard.asi.reserved")}
                          </span>
                        )}
                        {capBlocked && (
                          <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                            · {tr("wizard.asi.atCapTag")}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                        {fd.summary}
                      </p>
                    </div>
                    <input
                      type="radio"
                      name={`asi-feat-${idx}`}
                      checked={picked}
                      disabled={disabled}
                      onChange={() => pickFeat(feat.id)}
                    />
                  </label>
                  {picked && (
                    <ul className="mt-3 space-y-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                      {fd.grants.map((line, i) => (
                        <li key={i}>· {line}</li>
                      ))}
                    </ul>
                  )}
                  {picked && needsAbilityChoice && feat.abilityBonus && (
                    <div className="mt-3">
                      <p className="label mb-2">{tr("wizard.feats.pickAbility", { n: feat.abilityBonus.value })}</p>
                      <div className="flex flex-wrap gap-2">
                        {feat.abilityBonus.from.map((ab) => {
                          const overCap =
                            (preTotals?.[ab] ?? 0) + feat.abilityBonus!.value > ABILITY_CAP;
                          const lab = localizedAbilityLabel(ab, locale);
                          return (
                            <button
                              key={ab}
                              onClick={() => pickFeatAbility(ab)}
                              disabled={overCap}
                              className={value.abilityChoice === ab ? "btn-accent" : "btn-ghost"}
                              style={{ padding: "4px 10px", fontSize: 12, opacity: overCap ? 0.5 : 1 }}
                              title={
                                overCap
                                  ? tr("wizard.asi.wouldExceed", { label: lab })
                                  : undefined
                              }
                            >
                              {lab}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function buildKnownSpells(params: {
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenPrepared: string[];
  chosenRacialCantrip: string[];
  grantedRacialCantrips: { spellId: string; ability: Ability }[];
  preparation?: "known" | "prepared" | "spellbook";
  /** Clérigo / druida / paladín: repertorio completo en ficha, subconjunto preparado (PHB cap. 10). */
  preparedCaster?: {
    classId: SpellClassId;
    characterLevel: number;
    caster: NonNullable<ClassBasics["spellcasting"]>["caster"];
  };
  locale: AppLocale;
}): { name: string; level: number; prepared: boolean }[] {
  const {
    chosenCantrips,
    chosenSpells,
    chosenPrepared,
    chosenRacialCantrip,
    grantedRacialCantrips,
    preparation,
    preparedCaster,
    locale,
  } = params;
  const out: { name: string; level: number; prepared: boolean }[] = [];
  const seen = new Set<string>();
  const push = (spellId: string, prepared: boolean) => {
    if (seen.has(spellId)) return;
    const spell = SPELLS.find((s) => s.id === spellId);
    if (!spell) return;
    seen.add(spellId);
    const loc = spellForLocale(spell, locale);
    out.push({ name: loc.name, level: loc.level, prepared });
  };
  for (const id of chosenCantrips) push(id, true);
  for (const id of chosenRacialCantrip) push(id, true);
  for (const g of grantedRacialCantrips) push(g.spellId, true);
  // Mago con grimorio (PHB p. 114): copia al libro y prepara un subconjunto.
  if (preparation === "spellbook") {
    const preparedSet = new Set(chosenPrepared);
    for (const id of chosenSpells) push(id, preparedSet.has(id));
  } else if (preparation === "prepared" && preparedCaster) {
    const maxLv = maxCastableSpellLevel(preparedCaster.caster, preparedCaster.characterLevel);
    if (maxLv >= 1) {
      const full = spellsForClassUpToLevel(preparedCaster.classId, maxLv)
        .filter((s) => s.level >= 1)
        .map((s) => spellForLocale(s, locale))
        .sort((a, b) =>
          a.level !== b.level ? a.level - b.level : a.name.localeCompare(b.name, spellSortLocale(locale)),
        );
      const preparedSet = new Set(chosenSpells);
      for (const s of full) push(s.id, preparedSet.has(s.id));
    } else {
      for (const id of chosenSpells) push(id, true);
    }
  } else {
    for (const id of chosenSpells) push(id, true);
  }
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
