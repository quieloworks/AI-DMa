import { z } from "zod";

export const ABILITIES = ["fue", "des", "con", "int", "sab", "car"] as const;
export type Ability = (typeof ABILITIES)[number];

export const ABILITY_LABEL: Record<Ability, string> = {
  fue: "Fuerza",
  des: "Destreza",
  con: "Constitución",
  int: "Inteligencia",
  sab: "Sabiduría",
  car: "Carisma",
};

export const SKILLS: Record<string, { label: string; ability: Ability }> = {
  acrobacias: { label: "Acrobacias", ability: "des" },
  arcanos: { label: "Arcanos", ability: "int" },
  atletismo: { label: "Atletismo", ability: "fue" },
  engano: { label: "Engaño", ability: "car" },
  historia: { label: "Historia", ability: "int" },
  intimidacion: { label: "Intimidación", ability: "car" },
  investigacion: { label: "Investigación", ability: "int" },
  juegoDeManos: { label: "Juego de manos", ability: "des" },
  medicina: { label: "Medicina", ability: "sab" },
  naturaleza: { label: "Naturaleza", ability: "int" },
  percepcion: { label: "Percepción", ability: "sab" },
  interpretacion: { label: "Interpretación", ability: "car" },
  persuasion: { label: "Persuasión", ability: "car" },
  religion: { label: "Religión", ability: "int" },
  sigilo: { label: "Sigilo", ability: "des" },
  supervivencia: { label: "Supervivencia", ability: "sab" },
  perspicacia: { label: "Perspicacia", ability: "sab" },
  tratoConAnimales: { label: "Trato con animales", ability: "sab" },
};

export const CharacterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  level: z.number().int().min(1).max(20),
  race: z.string(),
  subrace: z.string().optional(),
  class: z.string(),
  subclass: z.string().optional(),
  background: z.string(),
  alignment: z.string().optional(),
  abilities: z.object({
    fue: z.number().int(),
    des: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    sab: z.number().int(),
    car: z.number().int(),
  }),
  abilityRacialBonus: z
    .object({
      fue: z.number().int().optional(),
      des: z.number().int().optional(),
      con: z.number().int().optional(),
      int: z.number().int().optional(),
      sab: z.number().int().optional(),
      car: z.number().int().optional(),
    })
    .default({}),
  skills: z.array(z.string()).default([]),
  savingThrows: z.array(z.enum(ABILITIES)).default([]),
  hp: z.object({
    max: z.number().int(),
    current: z.number().int(),
    temp: z.number().int().default(0),
    hitDie: z.number().int(),
  }),
  ac: z.number().int(),
  speed: z.number().int().default(30),
  initiativeBonus: z.number().int().default(0),
  proficiencies: z
    .object({
      armor: z.array(z.string()).default([]),
      weapons: z.array(z.string()).default([]),
      tools: z.array(z.string()).default([]),
      languages: z.array(z.string()).default([]),
    })
    .default({ armor: [], weapons: [], tools: [], languages: [] }),
  equipment: z.array(z.object({ name: z.string(), qty: z.number().int().default(1), notes: z.string().optional() })).default([]),
  money: z
    .object({ cp: z.number().int().default(0), sp: z.number().int().default(0), ep: z.number().int().default(0), gp: z.number().int().default(0), pp: z.number().int().default(0) })
    .default({ cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }),
  spells: z
    .object({
      ability: z.enum(ABILITIES).optional(),
      known: z.array(z.object({ name: z.string(), level: z.number().int(), prepared: z.boolean().default(false) })).default([]),
      slots: z.record(z.string(), z.object({ max: z.number().int(), used: z.number().int() })).default({}),
    })
    .default({ known: [], slots: {} }),
  features: z.array(z.object({ name: z.string(), source: z.string(), text: z.string() })).default([]),
  portrait: z.string().optional(),
  notes: z.string().optional(),
  personality: z
    .object({ traits: z.string().optional(), ideals: z.string().optional(), bonds: z.string().optional(), flaws: z.string().optional() })
    .default({}),
});

export type Character = z.infer<typeof CharacterSchema>;

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return Math.floor((level - 1) / 4) + 2;
}

export function effectiveAbility(char: Character, ab: Ability): number {
  return (char.abilities[ab] ?? 10) + (char.abilityRacialBonus[ab] ?? 0);
}

export function savingThrow(char: Character, ab: Ability): number {
  const mod = abilityMod(effectiveAbility(char, ab));
  const prof = char.savingThrows.includes(ab) ? proficiencyBonus(char.level) : 0;
  return mod + prof;
}

export function skillBonus(char: Character, skillKey: string): number {
  const s = SKILLS[skillKey];
  if (!s) return 0;
  const mod = abilityMod(effectiveAbility(char, s.ability));
  const prof = char.skills.includes(skillKey) ? proficiencyBonus(char.level) : 0;
  return mod + prof;
}

export function initiative(char: Character): number {
  return abilityMod(effectiveAbility(char, "des")) + (char.initiativeBonus ?? 0);
}

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export const POINT_BUY_COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export function pointBuyTotal(scores: Record<Ability, number>): number {
  return (Object.values(scores) as number[]).reduce((acc, v) => acc + (POINT_BUY_COST[v] ?? 99), 0);
}

export type ClassBasics = {
  id: string;
  label: string;
  hitDie: number;
  primaryAbility: Ability[];
  savingThrows: [Ability, Ability];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  spellcasting?: { ability: Ability; caster: "full" | "half" | "third" | "pact" };
};

export const CLASSES: ClassBasics[] = [
  { id: "barbaro", label: "Bárbaro", hitDie: 12, primaryAbility: ["fue"], savingThrows: ["fue", "con"], armorProficiencies: ["Armadura ligera", "Armadura media", "Escudos"], weaponProficiencies: ["Armas sencillas", "Armas marciales"] },
  { id: "bardo", label: "Bardo", hitDie: 8, primaryAbility: ["car"], savingThrows: ["des", "car"], armorProficiencies: ["Armadura ligera"], weaponProficiencies: ["Armas sencillas", "Ballestas de mano", "Espadas largas", "Estoques", "Espadas cortas"], spellcasting: { ability: "car", caster: "full" } },
  { id: "clerigo", label: "Clérigo", hitDie: 8, primaryAbility: ["sab"], savingThrows: ["sab", "car"], armorProficiencies: ["Armadura ligera", "Armadura media", "Escudos"], weaponProficiencies: ["Armas sencillas"], spellcasting: { ability: "sab", caster: "full" } },
  { id: "druida", label: "Druida", hitDie: 8, primaryAbility: ["sab"], savingThrows: ["int", "sab"], armorProficiencies: ["Armadura ligera (no metálica)", "Armadura media (no metálica)", "Escudos (no metálicos)"], weaponProficiencies: ["Garrotes", "Dagas", "Dardos", "Jabalinas", "Mazas", "Bastones", "Cimitarras", "Hoces", "Hondas", "Lanzas"], spellcasting: { ability: "sab", caster: "full" } },
  { id: "guerrero", label: "Guerrero", hitDie: 10, primaryAbility: ["fue", "des"], savingThrows: ["fue", "con"], armorProficiencies: ["Todas las armaduras", "Escudos"], weaponProficiencies: ["Armas sencillas", "Armas marciales"] },
  { id: "monje", label: "Monje", hitDie: 8, primaryAbility: ["des", "sab"], savingThrows: ["fue", "des"], armorProficiencies: [], weaponProficiencies: ["Armas sencillas", "Espadas cortas"] },
  { id: "paladin", label: "Paladín", hitDie: 10, primaryAbility: ["fue", "car"], savingThrows: ["sab", "car"], armorProficiencies: ["Todas las armaduras", "Escudos"], weaponProficiencies: ["Armas sencillas", "Armas marciales"], spellcasting: { ability: "car", caster: "half" } },
  { id: "explorador", label: "Explorador", hitDie: 10, primaryAbility: ["des", "sab"], savingThrows: ["fue", "des"], armorProficiencies: ["Armadura ligera", "Armadura media", "Escudos"], weaponProficiencies: ["Armas sencillas", "Armas marciales"], spellcasting: { ability: "sab", caster: "half" } },
  { id: "picaro", label: "Pícaro", hitDie: 8, primaryAbility: ["des"], savingThrows: ["des", "int"], armorProficiencies: ["Armadura ligera"], weaponProficiencies: ["Armas sencillas", "Ballestas de mano", "Espadas largas", "Estoques", "Espadas cortas"] },
  { id: "hechicero", label: "Hechicero", hitDie: 6, primaryAbility: ["car"], savingThrows: ["con", "car"], armorProficiencies: [], weaponProficiencies: ["Dagas", "Dardos", "Hondas", "Bastones", "Ballestas ligeras"], spellcasting: { ability: "car", caster: "full" } },
  { id: "brujo", label: "Brujo", hitDie: 8, primaryAbility: ["car"], savingThrows: ["sab", "car"], armorProficiencies: ["Armadura ligera"], weaponProficiencies: ["Armas sencillas"], spellcasting: { ability: "car", caster: "pact" } },
  { id: "mago", label: "Mago", hitDie: 6, primaryAbility: ["int"], savingThrows: ["int", "sab"], armorProficiencies: [], weaponProficiencies: ["Dagas", "Dardos", "Hondas", "Bastones", "Ballestas ligeras"], spellcasting: { ability: "int", caster: "full" } },
];

export type RaceBasics = {
  id: string;
  label: string;
  speed: number;
  abilityBonus: Partial<Record<Ability, number>>;
  traits: string[];
  languages: string[];
};

export const RACES: RaceBasics[] = [
  { id: "humano", label: "Humano", speed: 30, abilityBonus: { fue: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 }, traits: ["Versatilidad humana"], languages: ["Común", "Un idioma adicional"] },
  { id: "elfo", label: "Elfo", speed: 30, abilityBonus: { des: 2 }, traits: ["Visión en la oscuridad", "Sentidos agudos", "Ascendencia feérica", "Trance"], languages: ["Común", "Élfico"] },
  { id: "enano", label: "Enano", speed: 25, abilityBonus: { con: 2 }, traits: ["Visión en la oscuridad", "Resiliencia enana", "Entrenamiento de combate enano", "Familiaridad con herramientas"], languages: ["Común", "Enano"] },
  { id: "mediano", label: "Mediano", speed: 25, abilityBonus: { des: 2 }, traits: ["Afortunado", "Valiente", "Agilidad mediana"], languages: ["Común", "Mediano"] },
  { id: "gnomo", label: "Gnomo", speed: 25, abilityBonus: { int: 2 }, traits: ["Visión en la oscuridad", "Astucia gnoma"], languages: ["Común", "Gnomo"] },
  { id: "semielfo", label: "Semielfo", speed: 30, abilityBonus: { car: 2 }, traits: ["Visión en la oscuridad", "Ancestro feérico", "Versatilidad de habilidades"], languages: ["Común", "Élfico", "Un idioma adicional"] },
  { id: "semiorco", label: "Semiorco", speed: 30, abilityBonus: { fue: 2, con: 1 }, traits: ["Visión en la oscuridad", "Amenazador", "Agresivo", "Aguante implacable", "Ataques salvajes"], languages: ["Común", "Orco"] },
  { id: "tiefling", label: "Tiefling", speed: 30, abilityBonus: { car: 2, int: 1 }, traits: ["Visión en la oscuridad", "Resistencia infernal", "Legado infernal"], languages: ["Común", "Infernal"] },
  { id: "dracónido", label: "Dracónido", speed: 30, abilityBonus: { fue: 2, car: 1 }, traits: ["Ascendencia dracónica", "Aliento de dragón", "Resistencia al daño"], languages: ["Común", "Dracónico"] },
];

export type BackgroundBasics = {
  id: string;
  label: string;
  skillProficiencies: string[];
  languages: number;
  tools: string[];
  equipment: string[];
  feature: { name: string; text: string };
};

export const BACKGROUNDS: BackgroundBasics[] = [
  { id: "acolito", label: "Acólito", skillProficiencies: ["perspicacia", "religion"], languages: 2, tools: [], equipment: ["Símbolo sagrado", "Libro de oraciones", "5 varillas de incienso", "Vestiduras", "Atuendo común", "15 po"], feature: { name: "Refugio de los fieles", text: "Recibes cuidado y hospitalidad en templos y santuarios de tu fe." } },
  { id: "artesano", label: "Artesano de gremio", skillProficiencies: ["perspicacia", "persuasion"], languages: 1, tools: ["Herramientas de un artesano"], equipment: ["Herramientas de artesano", "Carta de presentación del gremio", "Atuendo de viajero", "15 po"], feature: { name: "Miembro del gremio", text: "Puedes contar con la ayuda del gremio donde vayas." } },
  { id: "criminal", label: "Criminal", skillProficiencies: ["engano", "sigilo"], languages: 0, tools: ["Juego de herramientas de ladrón", "Un juego de juegos"], equipment: ["Palanca", "Atuendo oscuro común con capucha", "Bolsa con 15 po"], feature: { name: "Contacto criminal", text: "Tienes un contacto confiable en el bajo mundo." } },
  { id: "forastero", label: "Forastero", skillProficiencies: ["atletismo", "supervivencia"], languages: 1, tools: ["Un instrumento musical"], equipment: ["Bastón", "Trampa de caza", "Trofeo de un animal", "Atuendo de viajero", "10 po"], feature: { name: "Errante", text: "Recuerdas la geografía del terreno salvaje y puedes encontrar comida y agua para ti y cinco personas más." } },
  { id: "heroePueblo", label: "Héroe del pueblo", skillProficiencies: ["tratoConAnimales", "supervivencia"], languages: 0, tools: ["Un juego de herramientas de artesano", "Vehículos de tierra"], equipment: ["Herramientas de artesano", "Pala", "Olla de hierro", "Atuendo común", "10 po"], feature: { name: "Hospitalidad rústica", text: "La gente del pueblo y campesinos te abren sus puertas." } },
  { id: "marinero", label: "Marinero", skillProficiencies: ["atletismo", "percepcion"], languages: 0, tools: ["Vehículos acuáticos", "Herramientas de navegante"], equipment: ["Clavija de atraque", "18 m de cuerda de seda", "Amuleto de la suerte", "Atuendo común", "10 po"], feature: { name: "Pasaje gratis", text: "Puedes conseguir pasaje gratuito en un barco mercante para ti y tus compañeros." } },
  { id: "noble", label: "Noble", skillProficiencies: ["historia", "persuasion"], languages: 1, tools: ["Un juego de juegos"], equipment: ["Atuendo fino", "Anillo con sello", "Pergamino de linaje", "25 po"], feature: { name: "Posición privilegiada", text: "La gente común te trata con deferencia dada tu posición." } },
  { id: "sabio", label: "Sabio", skillProficiencies: ["arcanos", "historia"], languages: 2, tools: [], equipment: ["Botella de tinta", "Pluma", "Cuchillo pequeño", "Carta de un colega con una pregunta sin responder", "Atuendo común", "10 po"], feature: { name: "Investigador", text: "Cuando intentas aprender o recordar algo, sabes dónde y de quién obtener la información." } },
  { id: "soldado", label: "Soldado", skillProficiencies: ["atletismo", "intimidacion"], languages: 0, tools: ["Un juego de juegos", "Vehículos de tierra"], equipment: ["Insignia de rango", "Trofeo de batalla", "Juego de dados o baraja", "Atuendo común", "10 po"], feature: { name: "Rango militar", text: "Soldados leales te reconocen y te ofrecen apoyo." } },
];

export function maxHpAtLevel1(hitDie: number, conMod: number): number {
  return hitDie + conMod;
}

export function maxHpAtLevel(level: number, hitDie: number, conMod: number): number {
  if (level <= 1) return maxHpAtLevel1(hitDie, conMod);
  const avgExtra = Math.floor(hitDie / 2) + 1;
  return maxHpAtLevel1(hitDie, conMod) + (level - 1) * (avgExtra + conMod);
}

export const SPELL_SLOTS_FULL_CASTER: Record<number, number[]> = {
  1: [2],
  2: [3],
  3: [4, 2],
  4: [4, 3],
  5: [4, 3, 2],
  6: [4, 3, 3],
  7: [4, 3, 3, 1],
  8: [4, 3, 3, 2],
  9: [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

export function spellSlotsFor(caster: "full" | "half" | "third" | "pact", level: number) {
  if (caster === "full") return SPELL_SLOTS_FULL_CASTER[Math.min(20, Math.max(1, level))] ?? [];
  if (caster === "half") {
    const lvl = Math.floor((level + 1) / 2);
    return SPELL_SLOTS_FULL_CASTER[Math.min(20, lvl)] ?? [];
  }
  if (caster === "third") {
    const lvl = Math.floor(level / 3);
    return SPELL_SLOTS_FULL_CASTER[Math.min(20, lvl)] ?? [];
  }
  if (caster === "pact") {
    const slots = level >= 17 ? 4 : level >= 11 ? 3 : level >= 2 ? 2 : 1;
    const slotLevel = Math.min(5, Math.ceil(level / 2));
    const arr = new Array(slotLevel).fill(0);
    arr[slotLevel - 1] = slots;
    return arr;
  }
  return [];
}
