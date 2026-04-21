import { z } from "zod";
import type { SpellClassId } from "./spells";

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
  playerName: z.string().optional(),
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

export const SKILL_KEYS = Object.keys(SKILLS);

export type EquipmentItem = { name: string; qty: number; note?: string };
export type EquipmentOption = { id: string; label: string; items: EquipmentItem[] };
export type EquipmentChoice = { id: string; label: string; options: EquipmentOption[] };

export type ArmorKind = "light" | "medium" | "heavy" | "shield";
export type ArmorEntry = {
  name: string;
  kind: ArmorKind;
  baseAc: number;
  maxDex?: number;
  stealthDisadvantage?: boolean;
};

// PHB pág. 145 ("Armor" table). Valores canónicos.
export const ARMORS: ArmorEntry[] = [
  { name: "Armadura acolchada", kind: "light", baseAc: 11, stealthDisadvantage: true },
  { name: "Armadura de cuero", kind: "light", baseAc: 11 },
  { name: "Armadura de cuero tachonado", kind: "light", baseAc: 12 },
  { name: "Piel", kind: "medium", baseAc: 12, maxDex: 2 },
  { name: "Camisote de mallas", kind: "medium", baseAc: 13, maxDex: 2, stealthDisadvantage: true },
  { name: "Armadura de escamas", kind: "medium", baseAc: 14, maxDex: 2, stealthDisadvantage: true },
  { name: "Coraza", kind: "medium", baseAc: 14, maxDex: 2 },
  { name: "Semiplaca", kind: "medium", baseAc: 15, maxDex: 2, stealthDisadvantage: true },
  { name: "Anillada", kind: "heavy", baseAc: 14, maxDex: 0, stealthDisadvantage: true },
  { name: "Cota de malla", kind: "heavy", baseAc: 16, maxDex: 0, stealthDisadvantage: true },
  { name: "Coselete", kind: "heavy", baseAc: 17, maxDex: 0, stealthDisadvantage: true },
  { name: "Placas", kind: "heavy", baseAc: 18, maxDex: 0, stealthDisadvantage: true },
  { name: "Escudo", kind: "shield", baseAc: 2 },
  { name: "Escudo de madera", kind: "shield", baseAc: 2 },
];

export function findArmor(name: string): ArmorEntry | undefined {
  const n = name.trim().toLowerCase();
  return ARMORS.find((a) => a.name.toLowerCase() === n);
}

export function computeAc(params: {
  equipment: EquipmentItem[];
  abilityScores: Record<Ability, number>;
  racialBonus?: Partial<Record<Ability, number>>;
  klassId?: string;
}): number {
  const { equipment, abilityScores, racialBonus = {}, klassId } = params;
  const score = (a: Ability) => (abilityScores[a] ?? 10) + (racialBonus[a] ?? 0);
  const dexMod = abilityMod(score("des"));
  const conMod = abilityMod(score("con"));
  const wisMod = abilityMod(score("sab"));

  let body: ArmorEntry | undefined;
  let hasShield = false;
  for (const it of equipment) {
    const e = findArmor(it.name);
    if (!e) continue;
    if (e.kind === "shield") {
      hasShield = true;
    } else if (!body || e.baseAc > body.baseAc) {
      body = e;
    }
  }

  const shieldBonus = hasShield ? 2 : 0;
  if (body) {
    const dexContribution = body.maxDex !== undefined ? Math.min(dexMod, body.maxDex) : dexMod;
    return body.baseAc + dexContribution + shieldBonus;
  }
  // Sin armadura: considerar Unarmored Defense del bárbaro (PHB p.48) y monje (PHB p.79).
  if (klassId === "barbaro") return 10 + dexMod + conMod + shieldBonus;
  if (klassId === "monje" && !hasShield) return 10 + dexMod + wisMod;
  return 10 + dexMod + shieldBonus;
}

export type ClassBasics = {
  id: string;
  label: string;
  hitDie: number;
  primaryAbility: Ability[];
  savingThrows: [Ability, Ability];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies?: string[];
  spellcasting?: {
    ability: Ability;
    caster: "full" | "half" | "third" | "pact";
    // Conteos a nivel 1 (PHB cap. 3). Si una clase arranca sin trucos/conjuros (paladín, explorador)
    // deja los conteos en 0 para que el wizard omita el paso.
    cantripsKnown?: number;
    // Para lanzadores "conocidos" (bardo, hechicero, brujo): número fijo de conjuros de nivel 1.
    spellsKnown?: number;
    // Para lanzadores "preparados" (clérigo, druida, mago, paladín): el número de conjuros
    // preparados equivale a `level + mod(ability)` con un mínimo de 1.
    preparation?: "known" | "prepared" | "spellbook";
    // Conjuros que un mago copia a su libro al crear el personaje (PHB p. 114).
    spellbookCount?: number;
  };
  skillChoices: { count: number; from: string[] };
  startingEquipmentFixed: EquipmentItem[];
  startingEquipmentChoices: EquipmentChoice[];
  startingGoldDice: { dice: number; faces: number; multiplier: number };
};

const ANY_SKILL = Object.keys(SKILLS);
const BARBARIAN_SKILLS = ["tratoConAnimales", "atletismo", "intimidacion", "naturaleza", "percepcion", "supervivencia"];
const CLERIC_SKILLS = ["historia", "perspicacia", "medicina", "persuasion", "religion"];
const DRUID_SKILLS = ["arcanos", "tratoConAnimales", "perspicacia", "medicina", "naturaleza", "percepcion", "religion", "supervivencia"];
const FIGHTER_SKILLS = ["acrobacias", "tratoConAnimales", "atletismo", "historia", "perspicacia", "intimidacion", "percepcion", "supervivencia"];
const MONK_SKILLS = ["acrobacias", "atletismo", "historia", "perspicacia", "religion", "sigilo"];
const PALADIN_SKILLS = ["atletismo", "perspicacia", "intimidacion", "medicina", "persuasion", "religion"];
const RANGER_SKILLS = ["tratoConAnimales", "atletismo", "perspicacia", "investigacion", "naturaleza", "percepcion", "sigilo", "supervivencia"];
const ROGUE_SKILLS = ["acrobacias", "atletismo", "engano", "perspicacia", "intimidacion", "investigacion", "percepcion", "interpretacion", "persuasion", "juegoDeManos", "sigilo"];
const SORCERER_SKILLS = ["arcanos", "engano", "perspicacia", "intimidacion", "persuasion", "religion"];
const WARLOCK_SKILLS = ["arcanos", "engano", "historia", "intimidacion", "investigacion", "naturaleza", "religion"];
const WIZARD_SKILLS = ["arcanos", "historia", "perspicacia", "investigacion", "medicina", "religion"];

const PACK_DUNGEONEER: EquipmentItem[] = [
  { name: "Mochila de aventurero", qty: 1 },
  { name: "Palanca", qty: 1 },
  { name: "Martillo", qty: 1 },
  { name: "10 clavos de hierro", qty: 1 },
  { name: "Ración seca", qty: 10 },
  { name: "Yesca", qty: 1 },
  { name: "Antorcha", qty: 10 },
  { name: "Cantimplora", qty: 1 },
  { name: "15m de cuerda de cáñamo", qty: 1 },
];
const PACK_EXPLORER: EquipmentItem[] = [
  { name: "Mochila de aventurero", qty: 1 },
  { name: "Saco de dormir", qty: 1 },
  { name: "Esterilla", qty: 1 },
  { name: "Yesca", qty: 1 },
  { name: "Antorcha", qty: 10 },
  { name: "Ración seca", qty: 10 },
  { name: "Cantimplora", qty: 1 },
  { name: "15m de cuerda de cáñamo", qty: 1 },
];
const PACK_PRIEST: EquipmentItem[] = [
  { name: "Mochila", qty: 1 },
  { name: "Manta", qty: 1 },
  { name: "Velas", qty: 10 },
  { name: "Caja de yesca", qty: 1 },
  { name: "Cepo de donativos", qty: 1 },
  { name: "2 palos de incienso", qty: 1 },
  { name: "Incensario", qty: 1 },
  { name: "Vestiduras", qty: 1 },
  { name: "Ración seca", qty: 2 },
  { name: "Cantimplora", qty: 1 },
];
const PACK_SCHOLAR: EquipmentItem[] = [
  { name: "Mochila", qty: 1 },
  { name: "Libro de saber", qty: 1 },
  { name: "Botella de tinta", qty: 1 },
  { name: "Pluma", qty: 1 },
  { name: "10 hojas de pergamino", qty: 1 },
  { name: "Pequeña bolsita de arena", qty: 1 },
  { name: "Cuchillito de cortar", qty: 1 },
];
const PACK_BURGLAR: EquipmentItem[] = [
  { name: "Mochila", qty: 1 },
  { name: "Canicas", qty: 1000 },
  { name: "Campana", qty: 1 },
  { name: "Velas", qty: 5 },
  { name: "Palanca", qty: 1 },
  { name: "Martillo", qty: 1 },
  { name: "Clavos de hierro", qty: 10 },
  { name: "Linterna ocultable", qty: 1 },
  { name: "Frasco de aceite", qty: 2 },
  { name: "Ración seca", qty: 5 },
  { name: "Caja de yesca", qty: 1 },
  { name: "Cantimplora", qty: 1 },
  { name: "15m de cuerda de cáñamo", qty: 1 },
];
const PACK_DIPLOMAT: EquipmentItem[] = [
  { name: "Baúl", qty: 1 },
  { name: "Cajas de mapas y pergaminos", qty: 2 },
  { name: "Atuendo fino", qty: 1 },
  { name: "Botella de tinta", qty: 1 },
  { name: "Pluma", qty: 1 },
  { name: "Lámpara", qty: 1 },
  { name: "Frasco de aceite", qty: 2 },
  { name: "5 hojas de papel", qty: 1 },
  { name: "Frasco de perfume", qty: 1 },
  { name: "Cera para sellar", qty: 1 },
  { name: "Jabón", qty: 1 },
];
const PACK_ENTERTAINER: EquipmentItem[] = [
  { name: "Mochila", qty: 1 },
  { name: "Saco de dormir", qty: 1 },
  { name: "2 disfraces", qty: 1 },
  { name: "Velas", qty: 5 },
  { name: "Ración seca", qty: 5 },
  { name: "Cantimplora", qty: 1 },
  { name: "Bolsa de baratijas", qty: 1 },
];

export const CLASSES: ClassBasics[] = [
  {
    id: "barbaro",
    label: "Bárbaro",
    hitDie: 12,
    primaryAbility: ["fue"],
    savingThrows: ["fue", "con"],
    armorProficiencies: ["Armadura ligera", "Armadura media", "Escudos"],
    weaponProficiencies: ["Armas sencillas", "Armas marciales"],
    skillChoices: { count: 2, from: BARBARIAN_SKILLS },
    startingEquipmentFixed: [
      { name: "Jabalina", qty: 4 },
      ...PACK_EXPLORER,
    ],
    startingEquipmentChoices: [
      {
        id: "arma-principal",
        label: "Arma principal",
        options: [
          { id: "gran-hacha", label: "(a) Gran hacha", items: [{ name: "Gran hacha", qty: 1 }] },
          { id: "marcial-cuerpo", label: "(b) Arma marcial cuerpo a cuerpo a elección", items: [{ name: "Arma marcial cuerpo a cuerpo", qty: 1, note: "Elige cualquiera con la que tengas competencia" }] },
        ],
      },
      {
        id: "arma-secundaria",
        label: "Arma secundaria",
        options: [
          { id: "dos-hachas", label: "(a) Dos hachas de mano", items: [{ name: "Hacha de mano", qty: 2 }] },
          { id: "arma-sencilla", label: "(b) Un arma sencilla a elección", items: [{ name: "Arma sencilla", qty: 1, note: "Elige cualquier arma sencilla" }] },
        ],
      },
    ],
    startingGoldDice: { dice: 2, faces: 4, multiplier: 10 },
  },
  {
    id: "bardo",
    label: "Bardo",
    hitDie: 8,
    primaryAbility: ["car"],
    savingThrows: ["des", "car"],
    armorProficiencies: ["Armadura ligera"],
    weaponProficiencies: ["Armas sencillas", "Ballestas de mano", "Espadas largas", "Estoques", "Espadas cortas"],
    toolProficiencies: ["Tres instrumentos musicales a elección"],
    spellcasting: { ability: "car", caster: "full", cantripsKnown: 2, spellsKnown: 4, preparation: "known" },
    skillChoices: { count: 3, from: ANY_SKILL },
    startingEquipmentFixed: [
      { name: "Armadura de cuero", qty: 1 },
      { name: "Daga", qty: 1 },
    ],
    startingEquipmentChoices: [
      {
        id: "arma",
        label: "Arma de bardo",
        options: [
          { id: "estoque", label: "(a) Estoque", items: [{ name: "Estoque", qty: 1 }] },
          { id: "espada-larga", label: "(b) Espada larga", items: [{ name: "Espada larga", qty: 1 }] },
          { id: "arma-sencilla", label: "(c) Un arma sencilla a elección", items: [{ name: "Arma sencilla", qty: 1, note: "Elige cualquier arma sencilla" }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete de exploración",
        options: [
          { id: "diplomat", label: "(a) Paquete de diplomático", items: PACK_DIPLOMAT },
          { id: "entertainer", label: "(b) Paquete de animador", items: PACK_ENTERTAINER },
        ],
      },
      {
        id: "instrumento",
        label: "Instrumento musical",
        options: [
          { id: "laud", label: "(a) Laúd", items: [{ name: "Laúd", qty: 1 }] },
          { id: "otro", label: "(b) Otro instrumento musical a elección", items: [{ name: "Instrumento musical", qty: 1, note: "Elige cualquiera" }] },
        ],
      },
    ],
    startingGoldDice: { dice: 5, faces: 4, multiplier: 10 },
  },
  {
    id: "clerigo",
    label: "Clérigo",
    hitDie: 8,
    primaryAbility: ["sab"],
    savingThrows: ["sab", "car"],
    armorProficiencies: ["Armadura ligera", "Armadura media", "Escudos"],
    weaponProficiencies: ["Armas sencillas"],
    spellcasting: { ability: "sab", caster: "full", cantripsKnown: 3, preparation: "prepared" },
    skillChoices: { count: 2, from: CLERIC_SKILLS },
    startingEquipmentFixed: [
      { name: "Escudo", qty: 1 },
      { name: "Símbolo sagrado", qty: 1 },
    ],
    startingEquipmentChoices: [
      {
        id: "arma",
        label: "Arma principal",
        options: [
          { id: "maza", label: "(a) Maza", items: [{ name: "Maza", qty: 1 }] },
          { id: "martillo", label: "(b) Martillo de guerra (si tienes competencia)", items: [{ name: "Martillo de guerra", qty: 1 }] },
        ],
      },
      {
        id: "armadura",
        label: "Armadura",
        options: [
          { id: "escamas", label: "(a) Armadura de escamas", items: [{ name: "Armadura de escamas", qty: 1 }] },
          { id: "cuero", label: "(b) Armadura de cuero", items: [{ name: "Armadura de cuero", qty: 1 }] },
          { id: "cota-malla", label: "(c) Cota de malla (si tienes competencia)", items: [{ name: "Cota de malla", qty: 1 }] },
        ],
      },
      {
        id: "distancia",
        label: "Arma a distancia",
        options: [
          { id: "ballesta-ligera", label: "(a) Ballesta ligera + 20 virotes", items: [{ name: "Ballesta ligera", qty: 1 }, { name: "Virote", qty: 20 }] },
          { id: "sencilla", label: "(b) Cualquier arma sencilla", items: [{ name: "Arma sencilla", qty: 1, note: "Elige cualquiera" }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "priest", label: "(a) Paquete de sacerdote", items: PACK_PRIEST },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 5, faces: 4, multiplier: 10 },
  },
  {
    id: "druida",
    label: "Druida",
    hitDie: 8,
    primaryAbility: ["sab"],
    savingThrows: ["int", "sab"],
    armorProficiencies: ["Armadura ligera (no metálica)", "Armadura media (no metálica)", "Escudos (no metálicos)"],
    weaponProficiencies: ["Garrotes", "Dagas", "Dardos", "Jabalinas", "Mazas", "Bastones", "Cimitarras", "Hoces", "Hondas", "Lanzas"],
    toolProficiencies: ["Equipo de herbolario"],
    spellcasting: { ability: "sab", caster: "full", cantripsKnown: 2, preparation: "prepared" },
    skillChoices: { count: 2, from: DRUID_SKILLS },
    startingEquipmentFixed: [
      { name: "Armadura de cuero", qty: 1 },
      { name: "Paquete de explorador", qty: 1 },
      { name: "Foco drúdico", qty: 1 },
    ],
    startingEquipmentChoices: [
      {
        id: "escudo",
        label: "Escudo o arma",
        options: [
          { id: "escudo", label: "(a) Escudo de madera", items: [{ name: "Escudo de madera", qty: 1 }] },
          { id: "arma-sencilla", label: "(b) Arma sencilla", items: [{ name: "Arma sencilla", qty: 1, note: "Elige cualquiera" }] },
        ],
      },
      {
        id: "arma-principal",
        label: "Arma principal",
        options: [
          { id: "cimitarra", label: "(a) Cimitarra", items: [{ name: "Cimitarra", qty: 1 }] },
          { id: "arma-cuerpo", label: "(b) Cualquier arma sencilla cuerpo a cuerpo", items: [{ name: "Arma sencilla cuerpo a cuerpo", qty: 1, note: "Elige cualquiera" }] },
        ],
      },
    ],
    startingGoldDice: { dice: 2, faces: 4, multiplier: 10 },
  },
  {
    id: "guerrero",
    label: "Guerrero",
    hitDie: 10,
    primaryAbility: ["fue", "des"],
    savingThrows: ["fue", "con"],
    armorProficiencies: ["Todas las armaduras", "Escudos"],
    weaponProficiencies: ["Armas sencillas", "Armas marciales"],
    skillChoices: { count: 2, from: FIGHTER_SKILLS },
    startingEquipmentFixed: [],
    startingEquipmentChoices: [
      {
        id: "armadura",
        label: "Armadura",
        options: [
          { id: "cota-malla", label: "(a) Cota de malla", items: [{ name: "Cota de malla", qty: 1 }] },
          { id: "cuero-arco", label: "(b) Armadura de cuero, arco largo y 20 flechas", items: [{ name: "Armadura de cuero", qty: 1 }, { name: "Arco largo", qty: 1 }, { name: "Flecha", qty: 20 }] },
        ],
      },
      {
        id: "arma-principal",
        label: "Arma principal",
        options: [
          { id: "marcial-escudo", label: "(a) Arma marcial y escudo", items: [{ name: "Arma marcial", qty: 1, note: "A elección" }, { name: "Escudo", qty: 1 }] },
          { id: "dos-marciales", label: "(b) Dos armas marciales", items: [{ name: "Arma marcial", qty: 2, note: "A elección" }] },
        ],
      },
      {
        id: "arma-distancia",
        label: "Arma a distancia",
        options: [
          { id: "ballesta", label: "(a) Ballesta ligera + 20 virotes", items: [{ name: "Ballesta ligera", qty: 1 }, { name: "Virote", qty: 20 }] },
          { id: "hachas", label: "(b) Dos hachas de mano", items: [{ name: "Hacha de mano", qty: 2 }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "dungeoneer", label: "(a) Paquete de explorador de mazmorras", items: PACK_DUNGEONEER },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 5, faces: 4, multiplier: 10 },
  },
  {
    id: "monje",
    label: "Monje",
    hitDie: 8,
    primaryAbility: ["des", "sab"],
    savingThrows: ["fue", "des"],
    armorProficiencies: [],
    weaponProficiencies: ["Armas sencillas", "Espadas cortas"],
    toolProficiencies: ["Un tipo de herramientas de artesano o un instrumento musical a elección"],
    skillChoices: { count: 2, from: MONK_SKILLS },
    startingEquipmentFixed: [{ name: "Dardo", qty: 10 }],
    startingEquipmentChoices: [
      {
        id: "arma",
        label: "Arma",
        options: [
          { id: "espada-corta", label: "(a) Espada corta", items: [{ name: "Espada corta", qty: 1 }] },
          { id: "sencilla", label: "(b) Cualquier arma sencilla", items: [{ name: "Arma sencilla", qty: 1, note: "Elige cualquiera" }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "dungeoneer", label: "(a) Paquete de explorador de mazmorras", items: PACK_DUNGEONEER },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 5, faces: 4, multiplier: 1 },
  },
  {
    id: "paladin",
    label: "Paladín",
    hitDie: 10,
    primaryAbility: ["fue", "car"],
    savingThrows: ["sab", "car"],
    armorProficiencies: ["Todas las armaduras", "Escudos"],
    weaponProficiencies: ["Armas sencillas", "Armas marciales"],
    spellcasting: { ability: "car", caster: "half", cantripsKnown: 0 },
    skillChoices: { count: 2, from: PALADIN_SKILLS },
    startingEquipmentFixed: [
      { name: "Cota de malla", qty: 1 },
      { name: "Símbolo sagrado", qty: 1 },
    ],
    startingEquipmentChoices: [
      {
        id: "arma-principal",
        label: "Arma principal",
        options: [
          { id: "marcial-escudo", label: "(a) Arma marcial y escudo", items: [{ name: "Arma marcial", qty: 1, note: "A elección" }, { name: "Escudo", qty: 1 }] },
          { id: "dos-marciales", label: "(b) Dos armas marciales", items: [{ name: "Arma marcial", qty: 2, note: "A elección" }] },
        ],
      },
      {
        id: "secundaria",
        label: "Arma secundaria",
        options: [
          { id: "jabalinas", label: "(a) Cinco jabalinas", items: [{ name: "Jabalina", qty: 5 }] },
          { id: "cuerpo", label: "(b) Arma sencilla cuerpo a cuerpo", items: [{ name: "Arma sencilla cuerpo a cuerpo", qty: 1, note: "A elección" }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "priest", label: "(a) Paquete de sacerdote", items: PACK_PRIEST },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 5, faces: 4, multiplier: 10 },
  },
  {
    id: "explorador",
    label: "Explorador",
    hitDie: 10,
    primaryAbility: ["des", "sab"],
    savingThrows: ["fue", "des"],
    armorProficiencies: ["Armadura ligera", "Armadura media", "Escudos"],
    weaponProficiencies: ["Armas sencillas", "Armas marciales"],
    spellcasting: { ability: "sab", caster: "half", cantripsKnown: 0 },
    skillChoices: { count: 3, from: RANGER_SKILLS },
    startingEquipmentFixed: [
      { name: "Arco largo", qty: 1 },
      { name: "Flecha", qty: 20 },
    ],
    startingEquipmentChoices: [
      {
        id: "armadura",
        label: "Armadura",
        options: [
          { id: "escamas", label: "(a) Armadura de escamas", items: [{ name: "Armadura de escamas", qty: 1 }] },
          { id: "cuero", label: "(b) Armadura de cuero", items: [{ name: "Armadura de cuero", qty: 1 }] },
        ],
      },
      {
        id: "armas",
        label: "Armas cuerpo a cuerpo",
        options: [
          { id: "dos-espadas", label: "(a) Dos espadas cortas", items: [{ name: "Espada corta", qty: 2 }] },
          { id: "dos-sencillas", label: "(b) Dos armas sencillas cuerpo a cuerpo", items: [{ name: "Arma sencilla cuerpo a cuerpo", qty: 2, note: "A elección" }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "dungeoneer", label: "(a) Paquete de explorador de mazmorras", items: PACK_DUNGEONEER },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 5, faces: 4, multiplier: 10 },
  },
  {
    id: "picaro",
    label: "Pícaro",
    hitDie: 8,
    primaryAbility: ["des"],
    savingThrows: ["des", "int"],
    armorProficiencies: ["Armadura ligera"],
    weaponProficiencies: ["Armas sencillas", "Ballestas de mano", "Espadas largas", "Estoques", "Espadas cortas"],
    toolProficiencies: ["Herramientas de ladrón"],
    skillChoices: { count: 4, from: ROGUE_SKILLS },
    startingEquipmentFixed: [
      { name: "Armadura de cuero", qty: 1 },
      { name: "Daga", qty: 2 },
      { name: "Herramientas de ladrón", qty: 1 },
    ],
    startingEquipmentChoices: [
      {
        id: "principal",
        label: "Arma principal",
        options: [
          { id: "estoque", label: "(a) Estoque", items: [{ name: "Estoque", qty: 1 }] },
          { id: "espada-corta", label: "(b) Espada corta", items: [{ name: "Espada corta", qty: 1 }] },
        ],
      },
      {
        id: "secundaria",
        label: "Arma secundaria",
        options: [
          { id: "arco-corto", label: "(a) Arco corto + 20 flechas + carcaj", items: [{ name: "Arco corto", qty: 1 }, { name: "Flecha", qty: 20 }, { name: "Carcaj", qty: 1 }] },
          { id: "espada-corta", label: "(b) Espada corta", items: [{ name: "Espada corta", qty: 1 }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "burglar", label: "(a) Paquete de ladrón", items: PACK_BURGLAR },
          { id: "dungeoneer", label: "(b) Paquete de explorador de mazmorras", items: PACK_DUNGEONEER },
          { id: "explorer", label: "(c) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 4, faces: 4, multiplier: 10 },
  },
  {
    id: "hechicero",
    label: "Hechicero",
    hitDie: 6,
    primaryAbility: ["car"],
    savingThrows: ["con", "car"],
    armorProficiencies: [],
    weaponProficiencies: ["Dagas", "Dardos", "Hondas", "Bastones", "Ballestas ligeras"],
    spellcasting: { ability: "car", caster: "full", cantripsKnown: 4, spellsKnown: 2, preparation: "known" },
    skillChoices: { count: 2, from: SORCERER_SKILLS },
    startingEquipmentFixed: [{ name: "Daga", qty: 2 }],
    startingEquipmentChoices: [
      {
        id: "arma",
        label: "Arma",
        options: [
          { id: "ballesta", label: "(a) Ballesta ligera + 20 virotes", items: [{ name: "Ballesta ligera", qty: 1 }, { name: "Virote", qty: 20 }] },
          { id: "sencilla", label: "(b) Cualquier arma sencilla", items: [{ name: "Arma sencilla", qty: 1, note: "A elección" }] },
        ],
      },
      {
        id: "foco",
        label: "Foco arcano",
        options: [
          { id: "componentes", label: "(a) Bolsa de componentes", items: [{ name: "Bolsa de componentes", qty: 1 }] },
          { id: "foco", label: "(b) Foco arcano", items: [{ name: "Foco arcano", qty: 1 }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "dungeoneer", label: "(a) Paquete de explorador de mazmorras", items: PACK_DUNGEONEER },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 3, faces: 4, multiplier: 10 },
  },
  {
    id: "brujo",
    label: "Brujo",
    hitDie: 8,
    primaryAbility: ["car"],
    savingThrows: ["sab", "car"],
    armorProficiencies: ["Armadura ligera"],
    weaponProficiencies: ["Armas sencillas"],
    spellcasting: { ability: "car", caster: "pact", cantripsKnown: 2, spellsKnown: 2, preparation: "known" },
    skillChoices: { count: 2, from: WARLOCK_SKILLS },
    startingEquipmentFixed: [
      { name: "Armadura de cuero", qty: 1 },
      { name: "Daga", qty: 2 },
    ],
    startingEquipmentChoices: [
      {
        id: "arma",
        label: "Arma",
        options: [
          { id: "ballesta", label: "(a) Ballesta ligera + 20 virotes", items: [{ name: "Ballesta ligera", qty: 1 }, { name: "Virote", qty: 20 }] },
          { id: "sencilla", label: "(b) Cualquier arma sencilla", items: [{ name: "Arma sencilla", qty: 1, note: "A elección" }] },
        ],
      },
      {
        id: "foco",
        label: "Foco arcano",
        options: [
          { id: "componentes", label: "(a) Bolsa de componentes", items: [{ name: "Bolsa de componentes", qty: 1 }] },
          { id: "foco", label: "(b) Foco arcano", items: [{ name: "Foco arcano", qty: 1 }] },
        ],
      },
      {
        id: "arma-extra",
        label: "Arma cuerpo a cuerpo",
        options: [
          { id: "sencilla2", label: "Arma sencilla", items: [{ name: "Arma sencilla", qty: 1, note: "A elección" }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "scholar", label: "(a) Paquete de erudito", items: PACK_SCHOLAR },
          { id: "dungeoneer", label: "(b) Paquete de explorador de mazmorras", items: PACK_DUNGEONEER },
        ],
      },
    ],
    startingGoldDice: { dice: 4, faces: 4, multiplier: 10 },
  },
  {
    id: "mago",
    label: "Mago",
    hitDie: 6,
    primaryAbility: ["int"],
    savingThrows: ["int", "sab"],
    armorProficiencies: [],
    weaponProficiencies: ["Dagas", "Dardos", "Hondas", "Bastones", "Ballestas ligeras"],
    spellcasting: { ability: "int", caster: "full", cantripsKnown: 3, preparation: "spellbook", spellbookCount: 6 },
    skillChoices: { count: 2, from: WIZARD_SKILLS },
    startingEquipmentFixed: [{ name: "Libro de conjuros", qty: 1 }],
    startingEquipmentChoices: [
      {
        id: "arma",
        label: "Arma",
        options: [
          { id: "baston", label: "(a) Bastón", items: [{ name: "Bastón", qty: 1 }] },
          { id: "daga", label: "(b) Daga", items: [{ name: "Daga", qty: 1 }] },
        ],
      },
      {
        id: "foco",
        label: "Foco arcano",
        options: [
          { id: "componentes", label: "(a) Bolsa de componentes", items: [{ name: "Bolsa de componentes", qty: 1 }] },
          { id: "foco", label: "(b) Foco arcano", items: [{ name: "Foco arcano", qty: 1 }] },
        ],
      },
      {
        id: "paquete",
        label: "Paquete",
        options: [
          { id: "scholar", label: "(a) Paquete de erudito", items: PACK_SCHOLAR },
          { id: "explorer", label: "(b) Paquete de explorador", items: PACK_EXPLORER },
        ],
      },
    ],
    startingGoldDice: { dice: 4, faces: 4, multiplier: 10 },
  },
];

// Un truco que la raza/subraza otorga automáticamente. El id apunta a SPELLS.id;
// la ability determina con qué atributo se lanza (ej. tiefling → CAR).
export type RacialCantrip = {
  spellId: string;
  ability: Ability;
};

// Un truco que la raza/subraza permite elegir (ej. elfo alto → 1 truco de mago).
export type RacialCantripChoice = {
  fromClass: SpellClassId;
  ability: Ability;
  count: number;
};

export type RaceVariant = {
  id: string;
  label: string;
  abilityBonus?: Partial<Record<Ability, number>>;
  traits?: string[];
  speedOverride?: number;
  extraLanguages?: string[];
  bonusLanguages?: number;
  extraArmorProficiencies?: string[];
  extraWeaponProficiencies?: string[];
  hpBonusPerLevel?: number;
  damageType?: string;
  grantedCantrips?: RacialCantrip[];
  cantripChoice?: RacialCantripChoice;
  note?: string;
};

export type RaceBasics = {
  id: string;
  label: string;
  speed: number;
  abilityBonus: Partial<Record<Ability, number>>;
  traits: string[];
  languages: string[];
  bonusLanguages?: number;
  bonusSkills?: number;
  grantedCantrips?: RacialCantrip[];
  cantripChoice?: RacialCantripChoice;
  variants?: RaceVariant[];
  variantLabel?: string;
};

// PHB p. 123 ("Standard Languages" + "Exotic Languages").
export const STANDARD_LANGUAGES: string[] = [
  "Común",
  "Enano",
  "Élfico",
  "Gigante",
  "Gnomo",
  "Goblin",
  "Mediano",
  "Orco",
  "Abisal",
  "Celestial",
  "Dracónico",
  "Infernal",
  "Primordial",
  "Profundo",
  "Silvano",
  "Subcomún",
];

export const RACES: RaceBasics[] = [
  {
    id: "humano",
    label: "Humano",
    speed: 30,
    abilityBonus: { fue: 1, des: 1, con: 1, int: 1, sab: 1, car: 1 },
    traits: ["Versatilidad humana"],
    languages: ["Común"],
    bonusLanguages: 1,
  },
  {
    id: "elfo",
    label: "Elfo",
    speed: 30,
    abilityBonus: { des: 2 },
    traits: ["Visión en la oscuridad", "Sentidos agudos", "Ascendencia feérica", "Trance"],
    languages: ["Común", "Élfico"],
    variantLabel: "Subraza",
    variants: [
      {
        id: "alto",
        label: "Elfo alto",
        abilityBonus: { int: 1 },
        traits: ["Entrenamiento marcial élfico", "Truco de mago (INT)", "Idioma extra"],
        extraWeaponProficiencies: ["Espada larga", "Espada corta", "Arco corto", "Arco largo"],
        bonusLanguages: 1,
        cantripChoice: { fromClass: "mago", ability: "int", count: 1 },
      },
      {
        id: "bosque",
        label: "Elfo del bosque",
        abilityBonus: { sab: 1 },
        speedOverride: 35,
        traits: ["Entrenamiento marcial élfico", "Pies veloces", "Máscara del salvaje"],
        extraWeaponProficiencies: ["Espada larga", "Espada corta", "Arco corto", "Arco largo"],
      },
      {
        id: "drow",
        label: "Elfo oscuro (drow)",
        abilityBonus: { car: 1 },
        traits: ["Visión superior en la oscuridad (36m)", "Sensibilidad solar", "Magia drow", "Entrenamiento en armas drow"],
        extraWeaponProficiencies: ["Estoque", "Espada corta", "Ballesta de mano"],
        grantedCantrips: [{ spellId: "luces-danzantes", ability: "car" }],
      },
    ],
  },
  {
    id: "enano",
    label: "Enano",
    speed: 25,
    abilityBonus: { con: 2 },
    traits: ["Visión en la oscuridad", "Resiliencia enana", "Entrenamiento de combate enano", "Familiaridad con herramientas"],
    languages: ["Común", "Enano"],
    variantLabel: "Subraza",
    variants: [
      {
        id: "colina",
        label: "Enano de las colinas",
        abilityBonus: { sab: 1 },
        traits: ["Dureza enana (+1 PG por nivel)"],
        hpBonusPerLevel: 1,
      },
      {
        id: "montana",
        label: "Enano de las montañas",
        abilityBonus: { fue: 2 },
        traits: ["Entrenamiento con armaduras enano"],
        extraArmorProficiencies: ["Armadura ligera", "Armadura media"],
      },
    ],
  },
  {
    id: "mediano",
    label: "Mediano",
    speed: 25,
    abilityBonus: { des: 2 },
    traits: ["Afortunado", "Valiente", "Agilidad mediana"],
    languages: ["Común", "Mediano"],
    variantLabel: "Subraza",
    variants: [
      {
        id: "piesligeros",
        label: "Mediano piesligeros",
        abilityBonus: { car: 1 },
        traits: ["Sigilo natural"],
      },
      {
        id: "robusto",
        label: "Mediano robusto",
        abilityBonus: { con: 1 },
        traits: ["Resiliencia robusta (ventaja contra veneno, resistencia a daño de veneno)"],
      },
    ],
  },
  {
    id: "gnomo",
    label: "Gnomo",
    speed: 25,
    abilityBonus: { int: 2 },
    traits: ["Visión en la oscuridad", "Astucia gnoma"],
    languages: ["Común", "Gnomo"],
    variantLabel: "Subraza",
    variants: [
      {
        id: "bosque",
        label: "Gnomo del bosque",
        abilityBonus: { des: 1 },
        traits: ["Ilusionista natural (truco ilusión menor, INT)", "Hablar con bestias pequeñas"],
        grantedCantrips: [{ spellId: "ilusion-menor", ability: "int" }],
      },
      {
        id: "roca",
        label: "Gnomo de roca",
        abilityBonus: { con: 1 },
        traits: ["Conocimiento del artífice", "Manitas"],
      },
    ],
  },
  {
    id: "semielfo",
    label: "Semielfo",
    speed: 30,
    abilityBonus: { car: 2 },
    traits: ["Visión en la oscuridad", "Ancestro feérico", "Versatilidad de habilidades"],
    languages: ["Común", "Élfico"],
    bonusLanguages: 1,
    bonusSkills: 2,
  },
  {
    id: "semiorco",
    label: "Semiorco",
    speed: 30,
    abilityBonus: { fue: 2, con: 1 },
    traits: ["Visión en la oscuridad", "Amenazador", "Agresivo", "Aguante implacable", "Ataques salvajes"],
    languages: ["Común", "Orco"],
  },
  {
    id: "tiefling",
    label: "Tiefling",
    speed: 30,
    abilityBonus: { car: 2, int: 1 },
    traits: ["Visión en la oscuridad", "Resistencia infernal", "Legado infernal"],
    languages: ["Común", "Infernal"],
    grantedCantrips: [{ spellId: "taumaturgia", ability: "car" }],
  },
  {
    id: "dracónido",
    label: "Dracónido",
    speed: 30,
    abilityBonus: { fue: 2, car: 1 },
    traits: ["Ascendencia dracónica", "Aliento de dragón", "Resistencia al daño"],
    languages: ["Común", "Dracónico"],
    variantLabel: "Ancestro dracónico",
    variants: [
      { id: "negro", label: "Negro", damageType: "Ácido", traits: ["Aliento de ácido (línea de 9m × 1,5m, salvación DES)", "Resistencia a ácido"] },
      { id: "azul", label: "Azul", damageType: "Rayo", traits: ["Aliento de rayo (línea de 9m × 1,5m, salvación DES)", "Resistencia a rayo"] },
      { id: "laton", label: "Latón", damageType: "Fuego", traits: ["Aliento de fuego (línea de 9m × 1,5m, salvación DES)", "Resistencia a fuego"] },
      { id: "bronce", label: "Bronce", damageType: "Rayo", traits: ["Aliento de rayo (línea de 9m × 1,5m, salvación DES)", "Resistencia a rayo"] },
      { id: "cobre", label: "Cobre", damageType: "Ácido", traits: ["Aliento de ácido (línea de 9m × 1,5m, salvación DES)", "Resistencia a ácido"] },
      { id: "oro", label: "Oro", damageType: "Fuego", traits: ["Aliento de fuego (cono 4,5m, salvación DES)", "Resistencia a fuego"] },
      { id: "verde", label: "Verde", damageType: "Veneno", traits: ["Aliento de veneno (cono 4,5m, salvación CON)", "Resistencia a veneno"] },
      { id: "plata", label: "Plata", damageType: "Frío", traits: ["Aliento de frío (cono 4,5m, salvación CON)", "Resistencia a frío"] },
      { id: "rojo", label: "Rojo", damageType: "Fuego", traits: ["Aliento de fuego (cono 4,5m, salvación DES)", "Resistencia a fuego"] },
      { id: "blanco", label: "Blanco", damageType: "Frío", traits: ["Aliento de frío (cono 4,5m, salvación CON)", "Resistencia a frío"] },
    ],
  },
];

export type BackgroundBasics = {
  id: string;
  label: string;
  skillProficiencies: string[];
  languages: number;
  tools: string[];
  equipment: string[];
  startingMoney: { gp: number };
  feature: { name: string; text: string };
};

export const BACKGROUNDS: BackgroundBasics[] = [
  { id: "acolito", label: "Acólito", skillProficiencies: ["perspicacia", "religion"], languages: 2, tools: [], equipment: ["Símbolo sagrado", "Libro de oraciones", "5 varillas de incienso", "Vestiduras", "Atuendo común"], startingMoney: { gp: 15 }, feature: { name: "Refugio de los fieles", text: "Recibes cuidado y hospitalidad en templos y santuarios de tu fe." } },
  { id: "artesano", label: "Artesano de gremio", skillProficiencies: ["perspicacia", "persuasion"], languages: 1, tools: ["Herramientas de un artesano"], equipment: ["Herramientas de artesano", "Carta de presentación del gremio", "Atuendo de viajero"], startingMoney: { gp: 15 }, feature: { name: "Miembro del gremio", text: "Puedes contar con la ayuda del gremio donde vayas." } },
  { id: "charlatan", label: "Charlatán", skillProficiencies: ["engano", "juegoDeManos"], languages: 0, tools: ["Equipo de disfraz", "Herramientas de falsificador"], equipment: ["Atuendo fino", "Equipo de disfraz", "Herramientas del timo (dados trucados, cartas marcadas, frascos de líquido coloreado o anillo con sello falso)"], startingMoney: { gp: 15 }, feature: { name: "Identidad falsa", text: "Has creado una segunda identidad con documentación, conocidos y disfraces que te permiten asumir ese papel. Además puedes falsificar documentos oficiales y cartas personales si has visto un ejemplo del tipo de documento o caligrafía." } },
  { id: "criminal", label: "Criminal", skillProficiencies: ["engano", "sigilo"], languages: 0, tools: ["Juego de herramientas de ladrón", "Un juego de juegos"], equipment: ["Palanca", "Atuendo oscuro común con capucha"], startingMoney: { gp: 15 }, feature: { name: "Contacto criminal", text: "Tienes un contacto confiable en el bajo mundo." } },
  { id: "ermitano", label: "Ermitaño", skillProficiencies: ["medicina", "religion"], languages: 1, tools: ["Equipo de herbolario"], equipment: ["Portaescritos lleno de notas de estudios u oraciones", "Manta de invierno", "Atuendo común", "Equipo de herbolario"], startingMoney: { gp: 5 }, feature: { name: "Descubrimiento", text: "La reclusión de tu eremitorio te dio acceso a un descubrimiento único y poderoso. Su naturaleza exacta (una verdad cósmica, un lugar oculto, un hecho olvidado o una reliquia) la determinas con el DM." } },
  { id: "forastero", label: "Forastero", skillProficiencies: ["atletismo", "supervivencia"], languages: 1, tools: ["Un instrumento musical"], equipment: ["Bastón", "Trampa de caza", "Trofeo de un animal", "Atuendo de viajero"], startingMoney: { gp: 10 }, feature: { name: "Errante", text: "Recuerdas la geografía del terreno salvaje y puedes encontrar comida y agua para ti y cinco personas más." } },
  { id: "heroePueblo", label: "Héroe del pueblo", skillProficiencies: ["tratoConAnimales", "supervivencia"], languages: 0, tools: ["Un juego de herramientas de artesano", "Vehículos de tierra"], equipment: ["Herramientas de artesano", "Pala", "Olla de hierro", "Atuendo común"], startingMoney: { gp: 10 }, feature: { name: "Hospitalidad rústica", text: "La gente del pueblo y campesinos te abren sus puertas." } },
  { id: "huerfano", label: "Huérfano", skillProficiencies: ["juegoDeManos", "sigilo"], languages: 0, tools: ["Equipo de disfraz", "Juego de herramientas de ladrón"], equipment: ["Cuchillo pequeño", "Mapa de la ciudad en la que creciste", "Ratón mascota", "Objeto para recordar a tus padres", "Atuendo común"], startingMoney: { gp: 10 }, feature: { name: "Secretos de la ciudad", text: "Conoces los patrones y pasadizos secretos de las ciudades. Fuera de combate, tú (y compañeros que guíes) podéis viajar entre dos puntos urbanos al doble de vuestra velocidad normal." } },
  { id: "marinero", label: "Marinero", skillProficiencies: ["atletismo", "percepcion"], languages: 0, tools: ["Vehículos acuáticos", "Herramientas de navegante"], equipment: ["Clavija de atraque", "18 m de cuerda de seda", "Amuleto de la suerte", "Atuendo común"], startingMoney: { gp: 10 }, feature: { name: "Pasaje gratis", text: "Puedes conseguir pasaje gratuito en un barco mercante para ti y tus compañeros." } },
  { id: "noble", label: "Noble", skillProficiencies: ["historia", "persuasion"], languages: 1, tools: ["Un juego de juegos"], equipment: ["Atuendo fino", "Anillo con sello", "Pergamino de linaje"], startingMoney: { gp: 25 }, feature: { name: "Posición privilegiada", text: "La gente común te trata con deferencia dada tu posición." } },
  { id: "sabio", label: "Sabio", skillProficiencies: ["arcanos", "historia"], languages: 2, tools: [], equipment: ["Botella de tinta", "Pluma", "Cuchillo pequeño", "Carta de un colega con una pregunta sin responder", "Atuendo común"], startingMoney: { gp: 10 }, feature: { name: "Investigador", text: "Cuando intentas aprender o recordar algo, sabes dónde y de quién obtener la información." } },
  { id: "saltimbanqui", label: "Saltimbanqui", skillProficiencies: ["acrobacias", "interpretacion"], languages: 0, tools: ["Equipo de disfraz", "Un instrumento musical"], equipment: ["Instrumento musical a elección", "Prenda de un admirador (carta de amor, mechón de pelo o baratija)", "Disfraz", "Atuendo común"], startingMoney: { gp: 15 }, feature: { name: "Por demanda popular", text: "Siempre encuentras un sitio donde actuar (posada, taberna, circo o corte noble). Recibes alojamiento y comida gratis modestos o cómodos mientras actúes cada noche; la gente te reconoce cuando vuelves al lugar." } },
  { id: "soldado", label: "Soldado", skillProficiencies: ["atletismo", "intimidacion"], languages: 0, tools: ["Un juego de juegos", "Vehículos de tierra"], equipment: ["Insignia de rango", "Trofeo de batalla", "Juego de dados o baraja", "Atuendo común"], startingMoney: { gp: 10 }, feature: { name: "Rango militar", text: "Soldados leales te reconocen y te ofrecen apoyo." } },
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

// Número de conjuros de nivel 1+ que el personaje elige al crear ficha.
// - "known"    → `spellcasting.spellsKnown` (bardo, hechicero, brujo).
// - "prepared" → `level + mod(ability)` con mínimo 1 (clérigo, druida).
// - "spellbook"→ `spellcasting.spellbookCount` (mago copia 6 conjuros en su grimorio al nivel 1).
export function firstLevelSpellPicks(
  spellcasting: NonNullable<ClassBasics["spellcasting"]>,
  level: number,
  abilityScore: number,
): number {
  switch (spellcasting.preparation) {
    case "known":
      return spellcasting.spellsKnown ?? 0;
    case "spellbook":
      return spellcasting.spellbookCount ?? 0;
    case "prepared":
      return Math.max(1, level + abilityMod(abilityScore));
    default:
      return 0;
  }
}

export function spellSlotsFor(caster: "full" | "half" | "third" | "pact", level: number) {
  if (caster === "full") return SPELL_SLOTS_FULL_CASTER[Math.min(20, Math.max(1, level))] ?? [];
  if (caster === "half") {
    if (level < 2) return [];
    const lvl = Math.floor((level + 1) / 2);
    return SPELL_SLOTS_FULL_CASTER[Math.min(20, lvl)] ?? [];
  }
  if (caster === "third") {
    if (level < 3) return [];
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
