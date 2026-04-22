import type { Ability, FightingStyle } from "@/lib/character";
import { ABILITY_LABEL, SKILLS } from "@/lib/character";
import { ABILITY_ABBREV_EN } from "./overlays/en/labels";
import type { RaceBasics, RaceVariant, BackgroundBasics, ClassBasics } from "@/lib/character";
import type { SpellSchool } from "@/lib/spells";
import type { AppLocale } from "./locale";
import { normalizeLocale } from "./locale";
import { displayLanguageName } from "./language-names";
import { ABILITY_LABEL_EN, SKILL_LABEL_EN } from "./overlays/en/labels";
import { RACE_UI_EN } from "./overlays/en/races-ui";
import { CLASS_LABEL_EN } from "./overlays/en/classes-ui";
import { BACKGROUND_UI_EN } from "./overlays/en/backgrounds-ui";
import { SPELL_SCHOOL_EN } from "./overlays/en/schools-ui";
import { FIGHTING_STYLE_UI_EN } from "./overlays/en/fighting-styles-ui";
import { translateGameUiString } from "./mappings/es-to-en-phrases";

export function localizedAbilityLabel(ab: Ability, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "es") return ABILITY_LABEL[ab];
  return ABILITY_LABEL_EN[ab];
}

/** Short STR/DEX… (EN) or FUE/DES… (ES) for compact grids. */
export function localizedAbilityAbbrev(ab: Ability, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "es") return ab.toUpperCase();
  return ABILITY_ABBREV_EN[ab];
}

export function localizedSkillLabel(skillKey: string, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "es") return SKILLS[skillKey]?.label ?? skillKey;
  return SKILL_LABEL_EN[skillKey] ?? skillKey;
}

export function localizedRaceBasics(race: RaceBasics, locale: AppLocale | undefined): RaceBasics {
  const l = normalizeLocale(locale);
  if (l === "es") return race;
  const o = RACE_UI_EN[race.id];
  const langs = race.languages?.map((x) => displayLanguageName(x, "en"));
  const variants =
    race.variants?.map((v) => {
      const vo = o?.variants?.[v.id];
      return {
        ...v,
        label: vo?.label ?? v.label,
        traits: vo?.traits ?? v.traits,
        damageType: vo?.damageType ?? v.damageType,
      };
    }) ?? race.variants;
  return {
    ...race,
    label: o?.label ?? race.label,
    variantLabel: o?.variantLabel ?? race.variantLabel,
    traits: o?.traits ?? race.traits,
    languages: langs ?? race.languages,
    variants,
  };
}

/** Localize a lone variant when you already have `raceId` (e.g. summary strip). */
export function localizedRaceVariant(v: RaceVariant, raceId: string, locale: AppLocale | undefined): RaceVariant {
  const l = normalizeLocale(locale);
  if (l === "es") return v;
  const vo = RACE_UI_EN[raceId]?.variants?.[v.id];
  if (!vo) return v;
  return {
    ...v,
    label: vo.label ?? v.label,
    traits: vo.traits ?? v.traits,
    damageType: vo.damageType ?? v.damageType,
  };
}

export function localizedClassBasics(klass: ClassBasics, locale: AppLocale | undefined): ClassBasics {
  const l = normalizeLocale(locale);
  if (l === "es") return klass;
  const label = CLASS_LABEL_EN[klass.id] ?? klass.label;
  return { ...klass, label };
}

export function localizedBackgroundBasics(bg: BackgroundBasics, locale: AppLocale | undefined): BackgroundBasics {
  const l = normalizeLocale(locale);
  if (l === "es") return bg;
  const o = BACKGROUND_UI_EN[bg.id];
  if (!o) return bg;
  return {
    ...bg,
    label: o.label ?? bg.label,
    feature: {
      name: o.featureName ?? bg.feature.name,
      text: o.featureText ?? bg.feature.text,
    },
  };
}

/** Translate arbitrary UI strings embedded in equipment / pack data (Spanish source → English). */
export function localizeGamePhrase(text: string, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "es") return text;
  return translateGameUiString(text);
}

export function localizedSpellSchool(school: SpellSchool, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "en") return SPELL_SCHOOL_EN[school];
  return school.charAt(0).toUpperCase() + school.slice(1);
}

export function localizedFightingStyle(fs: FightingStyle, locale: AppLocale | undefined): FightingStyle {
  const l = normalizeLocale(locale);
  if (l === "es") return fs;
  const o = FIGHTING_STYLE_UI_EN[fs.id];
  return o ? { ...fs, label: o.label, summary: o.summary } : fs;
}

export { featForLocale } from "./feat-i18n";
