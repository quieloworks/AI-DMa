/**
 * UI-only English overlays for race cards (labels & trait blurbs). IDs match `lib/character.ts`.
 */
export type RaceVariantUiEn = {
  label?: string;
  traits?: string[];
  damageType?: string;
};

export type RaceUiEn = {
  label?: string;
  variantLabel?: string;
  traits?: string[];
  variants?: Record<string, RaceVariantUiEn>;
};

export const RACE_UI_EN: Record<string, RaceUiEn> = {
  humano: {
    label: "Human",
    variantLabel: "Variant",
    traits: ["Human versatility"],
    variants: {
      estandar: {
        label: "Standard Human",
        traits: ["+1 to all ability scores"],
      },
      variante: {
        label: "Variant Human",
        traits: [
          "Choose two different ability scores and increase each by +1",
          "Proficiency in one extra skill",
          "One starting feat of your choice",
        ],
      },
    },
  },
  elfo: {
    label: "Elf",
    variantLabel: "Subrace",
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance"],
    variants: {
      alto: {
        label: "High Elf",
        traits: ["Elf Weapon Training", "Cantrip (wizard, INT)", "Extra language"],
      },
      bosque: {
        label: "Wood Elf",
        traits: ["Elf Weapon Training", "Fleet of Foot", "Mask of the Wild"],
      },
      drow: {
        label: "Dark Elf (Drow)",
        traits: [
          "Superior Darkvision (120 ft)",
          "Sunlight Sensitivity",
          "Drow Magic",
          "Drow Weapon Training",
        ],
      },
    },
  },
  enano: {
    label: "Dwarf",
    variantLabel: "Subrace",
    traits: ["Darkvision", "Dwarven Resilience", "Dwarven Combat Training", "Stonecunning"],
    variants: {
      colina: {
        label: "Hill Dwarf",
        traits: ["Dwarven Toughness (+1 HP per level)"],
      },
      montana: {
        label: "Mountain Dwarf",
        traits: ["Dwarven Armor Training"],
      },
    },
  },
  mediano: {
    label: "Halfling",
    variantLabel: "Subrace",
    traits: ["Lucky", "Brave", "Halfling Nimbleness"],
    variants: {
      piesligeros: {
        label: "Lightfoot Halfling",
        traits: ["Naturally Stealthy"],
      },
      robusto: {
        label: "Stout Halfling",
        traits: ["Stout Resilience (advantage vs poison, resistance to poison damage)"],
      },
    },
  },
  gnomo: {
    label: "Gnome",
    variantLabel: "Subrace",
    traits: ["Darkvision", "Gnome Cunning"],
    variants: {
      bosque: {
        label: "Forest Gnome",
        traits: ["Natural Illusionist (minor illusion cantrip, INT)", "Speak with Small Beasts"],
      },
      roca: {
        label: "Rock Gnome",
        traits: ["Artificer's Lore", "Tinker"],
      },
    },
  },
  semielfo: {
    label: "Half-Elf",
    traits: ["Darkvision", "Fey Ancestry", "Skill Versatility"],
  },
  semiorco: {
    label: "Half-Orc",
    traits: ["Darkvision", "Menacing", "Savage Attacks", "Relentless Endurance"],
  },
  tiefling: {
    label: "Tiefling",
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
  },
  dracónido: {
    label: "Dragonborn",
    variantLabel: "Draconic ancestry",
    traits: ["Draconic ancestry", "Breath weapon", "Damage resistance"],
    variants: {
      negro: {
        label: "Black",
        damageType: "Acid",
        traits: ["Acid breath (30 ft line, DEX save)", "Acid resistance"],
      },
      azul: {
        label: "Blue",
        damageType: "Lightning",
        traits: ["Lightning breath (30 ft line, DEX save)", "Lightning resistance"],
      },
      laton: {
        label: "Brass",
        damageType: "Fire",
        traits: ["Fire breath (30 ft line, DEX save)", "Fire resistance"],
      },
      bronce: {
        label: "Bronze",
        damageType: "Lightning",
        traits: ["Lightning breath (30 ft line, DEX save)", "Lightning resistance"],
      },
      cobre: {
        label: "Copper",
        damageType: "Acid",
        traits: ["Acid breath (30 ft line, DEX save)", "Acid resistance"],
      },
      oro: {
        label: "Gold",
        damageType: "Fire",
        traits: ["Fire breath (15 ft cone, DEX save)", "Fire resistance"],
      },
      verde: {
        label: "Green",
        damageType: "Poison",
        traits: ["Poison breath (15 ft cone, CON save)", "Poison resistance"],
      },
      plata: {
        label: "Silver",
        damageType: "Cold",
        traits: ["Cold breath (15 ft cone, CON save)", "Cold resistance"],
      },
      rojo: {
        label: "Red",
        damageType: "Fire",
        traits: ["Fire breath (15 ft cone, DEX save)", "Fire resistance"],
      },
      blanco: {
        label: "White",
        damageType: "Cold",
        traits: ["Cold breath (15 ft cone, CON save)", "Cold resistance"],
      },
    },
  },
};
