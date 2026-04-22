/** English UI overlay for PHB-style feats (Spanish source in `lib/feats.ts`). */

export type FeatUiEn = {
  name: string;
  summary: string;
  grants: string[];
  prerequisite?: string;
};

export const FEAT_UI_EN: Record<string, FeatUiEn> = {
  actor: {
    name: "Actor",
    summary: "Skilled at mimicry and theatrical deception.",
    grants: [
      "+1 Charisma",
      "Advantage on Deception and Performance when trying to pass as another person",
      "You can mimic a creature's speech or sounds after hearing them for at least 1 minute",
    ],
  },
  alerta: {
    name: "Alert",
    summary: "You react before others and are never caught off guard.",
    grants: [
      "+5 initiative",
      "You can't be surprised while conscious",
      "Hidden attackers don't gain advantage against you",
    ],
  },
  "armadura-ligera": {
    name: "Lightly Armored",
    summary: "Basic training with light armor.",
    grants: ["+1 Strength or Dexterity (your choice)", "You gain proficiency with light armor"],
  },
  "armadura-media": {
    name: "Moderately Armored",
    summary: "You wear medium armor and shields effectively.",
    prerequisite: "Proficiency with light armor",
    grants: ["+1 Strength or Dexterity (your choice)", "You gain proficiency with medium armor and shields"],
  },
  "armadura-pesada": {
    name: "Heavily Armored",
    summary: "You can wear any armor in the book.",
    prerequisite: "Proficiency with medium armor",
    grants: ["+1 Strength", "You gain proficiency with heavy armor"],
  },
  "asesino-magos": {
    name: "Mage Slayer",
    summary: "Expert at shutting down spellcasters.",
    grants: [
      "Advantage on saving throws against spells cast within 5 feet of you",
      "Reaction: melee attack when a creature within 5 feet casts a spell",
      "Creatures you damage have disadvantage on concentration saves",
    ],
  },
  "atacante-salvaje": {
    name: "Savage Attacker",
    summary: "Brutal, unpredictable strikes.",
    grants: ["Once per turn, reroll your melee weapon damage dice and use either total"],
  },
  atleta: {
    name: "Athlete",
    summary: "Exceptional physical prowess.",
    grants: [
      "+1 Strength or Dexterity",
      "Standing up from prone uses only 5 feet of movement",
      "Climbing doesn't cost extra movement",
      "Running jump after only a 5-foot approach",
    ],
  },
  celador: {
    name: "Sentinel",
    summary: "You control the space around you with constant threat.",
    grants: [
      "Creatures you hit with opportunity attacks have speed 0 for the rest of the turn",
      "Disengage doesn't avoid your opportunity attacks",
      "When a creature within 5 feet attacks someone other than you, you can melee attack it as a reaction",
    ],
  },
  cargador: {
    name: "Charger",
    summary: "Turn a dash into a devastating hit.",
    grants: [
      "After using Dash, bonus action melee attack with +5 damage",
      "Or shove the target 10 feet instead of the extra damage",
    ],
  },
  curandero: {
    name: "Healer",
    summary: "Master of the healer's kit.",
    grants: [
      "Stabilizing with a healer's kit restores 1 hit point",
      "Action + one use of kit: heal 1d6+4 + your level (once per short rest)",
    ],
  },
  delver: {
    name: "Dungeon Delver",
    summary: "Expert in dungeons and ruins.",
    grants: [
      "Advantage on Perception/Investigation checks to find secret doors",
      "Advantage on saves vs traps and resistance to trap damage",
      "Travel at normal pace while searching without penalty",
    ],
  },
  "diestro-escudos": {
    name: "Shield Master",
    summary: "Your shield is weapon and bulwark.",
    grants: [
      "Bonus action: shove a creature within 5 feet with your shield (Strength save)",
      "Your shield's AC bonus applies to Dex saves vs effects that target only you",
      "If a spell forces a Dex save and you succeed, you take no damage instead of half",
    ],
  },
  "disciplina-elemental": {
    name: "Elemental Adept",
    prerequisite: "The ability to cast at least one spell",
    summary: "Specialize in one elemental damage type.",
    grants: [
      "Spells ignore resistance to your chosen damage type (acid, cold, fire, lightning, or thunder)",
      "Treat any 1 on damage dice of that type as a 2",
    ],
  },
  "duelista-defensivo": {
    name: "Defensive Duelist",
    prerequisite: "Dexterity 13",
    summary: "Parry with your finesse weapon.",
    grants: [
      "When hit by a melee attack while wielding a finesse weapon you're proficient with, reaction: add proficiency bonus to AC against that attack",
    ],
  },
  duradero: {
    name: "Durable",
    summary: "You bounce back faster after a rest.",
    grants: ["+1 Constitution", "When rolling hit dice to heal, minimum roll is twice your Constitution modifier"],
  },
  "experto-ballesta": {
    name: "Crossbow Expert",
    summary: "Deadly with crossbows at any range.",
    grants: [
      "Ignore the loading property on crossbows you're proficient with",
      "No disadvantage on ranged attacks while within 5 feet of a hostile creature",
      "When you attack with a one-handed weapon, bonus action hand crossbow attack",
    ],
  },
  francotirador: {
    name: "Sharpshooter",
    summary: "Lethal shots at any distance.",
    grants: [
      "No disadvantage from long range with ranged weapons",
      "Ranged attacks ignore half and three-quarters cover",
      "Before a ranged attack with a proficient weapon, take −5 to hit for +10 damage",
    ],
  },
  "gran-arma-maestro": {
    name: "Great Weapon Master",
    summary: "Heavy weapons hit harder in your hands.",
    grants: [
      "On crit or reducing a creature to 0 with a melee weapon, bonus action for another melee attack",
      "With a heavy melee weapon you're proficient with, take −5 to hit for +10 damage",
    ],
  },
  grapplero: {
    name: "Grappler",
    prerequisite: "Strength 13",
    summary: "Expert at grabs and holds.",
    grants: [
      "Advantage on attack rolls against creatures you're grappling",
      "Action: try to pin a grappled creature (both restrained)",
    ],
  },
  "iniciado-magia": {
    name: "Magic Initiate",
    summary: "Learn magic from another class.",
    grants: [
      "Choose a class (bard, cleric, druid, sorcerer, warlock, wizard): two cantrips + one 1st-level spell",
      "Cast the 1st-level spell once per long rest without a slot",
    ],
  },
  idiomas: {
    name: "Linguist",
    summary: "A natural polyglot.",
    grants: ["+1 Intelligence", "Learn three languages of your choice", "Create written ciphers only you and those you teach can read"],
  },
  jinete: {
    name: "Mounted Combatant",
    summary: "Deadly fighting from the saddle.",
    grants: [
      "Advantage on melee attacks vs creatures smaller than your mount",
      "Redirect an attack from your mount to yourself",
      "Mount uses your saves: no damage on success, half on failure vs Dex saves",
    ],
  },
  "lider-inspirador": {
    name: "Inspiring Leader",
    prerequisite: "Charisma 13",
    summary: "Your words rally the party.",
    grants: ["After 10 minutes of oratory, up to six creatures within 30 feet gain temp HP equal to level + Cha mod"],
  },
  "maestro-armadura-media": {
    name: "Medium Armor Master",
    prerequisite: "Proficiency with medium armor",
    summary: "You get the most out of medium armor.",
    grants: [
      "Medium armor doesn't impose disadvantage on Stealth",
      "You can add +3 from Dex (instead of +2) if your Dexterity is 16 or higher",
    ],
  },
  "maestro-armadura-pesada": {
    name: "Heavy Armor Master",
    prerequisite: "Proficiency with heavy armor",
    summary: "Heavy armor feels like a second skin.",
    grants: [
      "+1 Strength",
      "While in heavy armor, reduce nonmagical bludgeoning/piercing/slashing damage by 3",
    ],
  },
  "maestro-armas": {
    name: "Weapon Master",
    summary: "Broaden your martial arsenal.",
    grants: ["+1 Strength or Dexterity", "Proficiency with four weapons of your choice"],
  },
  "mente-aguda": {
    name: "Keen Mind",
    summary: "Superhuman memory and orientation.",
    grants: [
      "+1 Intelligence",
      "You always know which way is north and how many hours until dawn",
      "Accurately recall anything you've seen or heard in the past month",
    ],
  },
  mobil: {
    name: "Mobile",
    summary: "Light as the wind.",
    grants: [
      "+10 feet speed",
      "Dash ignores difficult terrain",
      "After melee vs a creature, it can't make opportunity attacks against you this turn",
    ],
  },
  observador: {
    name: "Observant",
    summary: "You notice every detail.",
    grants: [
      "+1 Intelligence or Wisdom",
      "+5 to passive Perception and passive Investigation",
      "Read lips if you know the creature's language",
    ],
  },
  polearmas: {
    name: "Polearm Master",
    summary: "Use every inch of reach.",
    grants: [
      "After attacking with glaive, halberd, quarterstaff, or spear, bonus action d4 bludgeoning with the opposite end",
      "Creatures provoke opportunity attacks when they enter your reach",
    ],
  },
  resiliente: {
    name: "Resilient",
    summary: "Excel at one kind of saving throw.",
    grants: ["+1 to chosen ability", "Gain proficiency in saving throws using that ability"],
  },
  ritualista: {
    name: "Ritual Caster",
    prerequisite: "Intelligence or Wisdom 13",
    summary: "Keeper of ritual knowledge.",
    grants: [
      "Ritual book with two 1st-level ritual spells from one class",
      "You can copy new ritual spells into your book",
    ],
  },
  sagaz: {
    name: "Lucky",
    summary: "Fortune smiles on you three times a day.",
    grants: [
      "3 luck points per long rest",
      "Spend 1 to roll an extra d20 on an attack, check, or save and choose which to use",
      "Spend 1 to make an attacker reroll against you",
    ],
  },
  "soldado-montado": {
    name: "Martial Adept",
    summary: "Battle Master–style maneuvers.",
    grants: ["Learn two maneuvers from the Battle Master archetype", "One superiority die (d6)"],
  },
  tabernario: {
    name: "Tavern Brawler",
    summary: "Anything is a weapon in your hands.",
    grants: [
      "+1 Strength or Constitution",
      "Proficiency with improvised weapons",
      "Your unarmed strike deals 1d4 bludgeoning",
      "After you hit with fist or improvised weapon, grapple as a bonus action",
    ],
  },
  "tirador-magico": {
    name: "Spell Sniper",
    prerequisite: "The ability to cast at least one spell",
    summary: "Your ranged spells are precise and long.",
    grants: [
      "Double range on spells that require attack rolls",
      "Spell attacks ignore half and three-quarters cover",
      "Learn one extra cantrip from a spellcasting class",
    ],
  },
  "tirador-preciso": {
    name: "Skulker",
    prerequisite: "Dexterity 13",
    summary: "Expert at staying unseen.",
    grants: [
      "Hide when only lightly obscured",
      "Missing a ranged attack doesn't reveal your position",
      "Dim light doesn't impose disadvantage on Perception",
    ],
  },
  tough: {
    name: "Tough",
    summary: "Harder to kill.",
    grants: ["Your hit point maximum increases by +2 per level"],
  },
  "usa-dos-armas": {
    name: "Dual Wielder",
    summary: "Perfected two-weapon fighting.",
    grants: [
      "+1 AC while wielding a melee weapon in each hand",
      "Two-weapon fighting works with non-light weapons",
      "Draw or stow two weapons when you could draw or stow one",
    ],
  },
  versatil: {
    name: "Skilled",
    summary: "Broaden your skill set.",
    grants: ["Gain proficiency in any combination of three skills or tools"],
  },
  "war-caster": {
    name: "War Caster",
    prerequisite: "The ability to cast at least one spell",
    summary: "Cast spells even under enemy fire.",
    grants: [
      "Advantage on Constitution saves to maintain concentration",
      "Perform somatic components with hands full (weapon or shield)",
      "Replace an opportunity attack with a single-target spell",
    ],
  },
};
