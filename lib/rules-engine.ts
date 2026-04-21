/**
 * Reglas derivadas en juego (PHB) — puntuaciones pasivas, notas de estilos que no afectan a computeAc.
 */

import type { Character } from "./character";
import { skillBonus } from "./character";

/** PHB p. 175: puntuación pasiva = 10 + bonif. de habilidad (incluye competencia si aplica). */
export function passiveSkill(char: Character, skillKey: string): number {
  return 10 + skillBonus(char, skillKey);
}

export function passivePerception(char: Character): number {
  return passiveSkill(char, "percepcion");
}

export function passiveInvestigation(char: Character): number {
  return passiveSkill(char, "investigacion");
}

export function passiveInsight(char: Character): number {
  return passiveSkill(char, "perspicacia");
}

export type FightingStyleHint = {
  attack?: string;
  damage?: string;
  ac?: string;
  reactionOrOther?: string;
};

/** Estilos cuyo efecto no está en `computeAc` (solo Defensa modifica CA allí). PHB p. 72, 84, 91. */
export function fightingStyleCombatHint(styleId: string): FightingStyleHint | null {
  switch (styleId) {
    case "arqueria":
      return { attack: "+2 a tiradas de ataque con armas a distancia." };
    case "duelo":
      return { damage: "+2 al daño con un arma cuerpo a cuerpo a una mano si no empuñas otra arma." };
    case "armas-grandes":
      return { reactionOrOther: "Puedes repetir un 1 o 2 en el daño de armas cuerpo a cuerpo a dos manos (o versátiles empuñadas a dos manos), una vez por tirada." };
    case "proteccion":
      return { reactionOrOther: "Reacción: impones desventaja al ataque contra un aliado a 1,5 m si llevas escudo." };
    case "dos-armas":
      return { damage: "Añades el modificador de atributo al daño del ataque adicional de la acción adicional con dos armas." };
    case "defensa":
      return { ac: "+1 a la CA con armadura (ya aplicado en la ficha si corresponde)." };
    default:
      return null;
  }
}
