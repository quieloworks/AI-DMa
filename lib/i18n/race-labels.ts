import type { AppLocale } from "./locale";
import { normalizeLocale } from "./locale";

const RACE_DISPLAY_EN: Record<string, string> = {
  Humano: "Human",
  Elfo: "Elf",
  Enano: "Dwarf",
  Mediano: "Halfling",
  Dracónido: "Dragonborn",
  Gnomo: "Gnome",
  "Semielfo": "Half-elf",
  "Semiorco": "Half-orc",
  Tiefling: "Tiefling",
};

export function displayRaceName(race: string | null | undefined, locale: AppLocale | undefined): string {
  if (!race) return "";
  const l = normalizeLocale(locale);
  if (l === "es") return race;
  return RACE_DISPLAY_EN[race.trim()] ?? race;
}
