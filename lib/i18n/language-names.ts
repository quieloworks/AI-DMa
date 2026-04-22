import type { AppLocale } from "./locale";
import { normalizeLocale } from "./locale";

/** Map Spanish PHB language labels (stored on sheets) to English display. */
const ES_TO_EN_LANGUAGE: Record<string, string> = {
  Común: "Common",
  Enano: "Dwarvish",
  Élfico: "Elvish",
  Gigante: "Giant",
  Gnomo: "Gnomish",
  Goblin: "Goblin",
  Mediano: "Halfling",
  Orco: "Orc",
  Abisal: "Abyssal",
  Celestial: "Celestial",
  Dracónico: "Draconic",
  Infernal: "Infernal",
  Primordial: "Primordial",
  Profundo: "Deep Speech",
  Silvano: "Sylvan",
  Subcomún: "Undercommon",
};

export function displayLanguageName(name: string, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "es") return name;
  return ES_TO_EN_LANGUAGE[name.trim()] ?? name;
}
