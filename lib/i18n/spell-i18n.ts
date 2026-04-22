import type { AppLocale } from "./locale";
import { normalizeLocale } from "./locale";
import type { Spell, SpellClassId } from "../spells";
import { spellsForClassUpToLevel } from "../spells";
import { SPELL_EN_OVERRIDES } from "./spell-en-overrides";
import { SPELL_NAME_EN_BY_ID } from "./data/spell-names-en";

function idToEnglishTitle(id: string): string {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Present spell name/description for UI and DM-facing lists according to locale. */
export function spellForLocale(spell: Spell, locale: AppLocale | undefined): Spell {
  const l = normalizeLocale(locale);
  if (l === "es") return spell;
  const o = SPELL_EN_OVERRIDES[spell.id];
  return {
    ...spell,
    name: o?.name ?? SPELL_NAME_EN_BY_ID[spell.id] ?? idToEnglishTitle(spell.id),
    description: o?.description ?? spell.description,
  };
}

export function spellSortLocale(locale: AppLocale | undefined): string {
  return normalizeLocale(locale) === "en" ? "en" : "es";
}

export function spellsForClassUpToLevelI18n(
  classId: SpellClassId,
  maxSpellLevel: number,
  locale: AppLocale | undefined,
): Spell[] {
  return spellsForClassUpToLevel(classId, maxSpellLevel)
    .map((s) => spellForLocale(s, locale))
    .sort((a, b) => a.name.localeCompare(b.name, spellSortLocale(locale)));
}
