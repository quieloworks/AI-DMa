import type { Ability } from "@/lib/character";

export const ABILITY_LABEL_EN: Record<Ability, string> = {
  fue: "Strength",
  des: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  sab: "Wisdom",
  car: "Charisma",
};

/** Keys must match `SKILLS` in `lib/character.ts`. */
export const SKILL_LABEL_EN: Record<string, string> = {
  acrobacias: "Acrobatics",
  arcanos: "Arcana",
  atletismo: "Athletics",
  engano: "Deception",
  historia: "History",
  intimidacion: "Intimidation",
  investigacion: "Investigation",
  juegoDeManos: "Sleight of Hand",
  medicina: "Medicine",
  naturaleza: "Nature",
  percepcion: "Perception",
  interpretacion: "Performance",
  persuasion: "Persuasion",
  religion: "Religion",
  sigilo: "Stealth",
  supervivencia: "Survival",
  perspicacia: "Insight",
  tratoConAnimales: "Animal Handling",
};
