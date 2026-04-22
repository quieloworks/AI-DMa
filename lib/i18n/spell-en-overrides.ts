/**
 * English display overrides for spells (PHB-style). Missing ids fall back to title-cased spell id for name
 * and Spanish description from `lib/spells.ts` until translated.
 */
export const SPELL_EN_OVERRIDES: Partial<Record<string, { name: string; description: string }>> = {
  "chorro-acido": {
    name: "Acid splash",
    description:
      "You hurl a bubble of acid; up to two creatures within 18 m make a DEX save or take 1d6 acid damage.",
  },
  "rayo-fuego": {
    name: "Fire bolt",
    description:
      "Ranged spell attack to 36 m; 1d10 fire damage. Unattended flammable objects ignite.",
  },
  "mano-mago": {
    name: "Mage hand",
    description:
      "Spectral hand manipulates light objects within 9 m for 1 minute.",
  },
  "luz": { name: "Light", description: "Object sheds bright light 6 m + dim light 6 m beyond for 1 hour." },
  "curar-heridas": {
    name: "Cure wounds",
    description: "A creature you touch regains 1d8 + your spellcasting modifier HP.",
  },
  "bola-fuego": {
    name: "Fireball",
    description: "45 m range; 6 m radius sphere; DEX save or 8d6 fire damage.",
  },
  "invisibilidad": {
    name: "Invisibility",
    description: "Creature you touch is invisible until it attacks or casts a spell.",
  },
  "detectar-magia": {
    name: "Detect magic",
    description: "Sense magic within 9 m for up to 10 minutes (concentration); identify school when focused.",
  },
};
