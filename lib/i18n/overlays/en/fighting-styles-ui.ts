import type { FightingStyleId } from "@/lib/character";

export const FIGHTING_STYLE_UI_EN: Record<
  FightingStyleId,
  { label: string; summary: string }
> = {
  arqueria: {
    label: "Archery",
    summary: "+2 to attack rolls you make with ranged weapons.",
  },
  defensa: {
    label: "Defense",
    summary: "+1 to AC while you are wearing armor.",
  },
  duelo: {
    label: "Dueling",
    summary: "+2 to damage rolls with a one-handed melee weapon when you are not wielding another weapon.",
  },
  "armas-grandes": {
    label: "Great Weapon Fighting",
    summary: "When you roll a 1 or 2 on a damage die for an attack with a melee weapon wielded with two hands, you can reroll the die.",
  },
  proteccion: {
    label: "Protection",
    summary: "When a creature you can see attacks a target within 5 feet of you, you can use your reaction to impose disadvantage on the attack roll if you wield a shield.",
  },
  "dos-armas": {
    label: "Two-Weapon Fighting",
    summary: "You can add your ability modifier to the damage of the second attack when fighting with two weapons.",
  },
};
