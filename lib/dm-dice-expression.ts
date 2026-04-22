import { abilityMod } from "@/lib/character";

type Ability = "fue" | "des" | "con" | "int" | "sab" | "car";

const ABILITIES: Ability[] = ["fue", "des", "con", "int", "sab", "car"];

export type ResolveDiceChar = {
  abilities?: Partial<Record<Ability, number>>;
  abilityRacialBonus?: Partial<Record<Ability, number>>;
};

function totalAbility(
  abilities: ResolveDiceChar["abilities"],
  racial: ResolveDiceChar["abilityRacialBonus"],
  a: Ability
): number {
  const base = abilities?.[a] ?? 10;
  const extra = racial?.[a] ?? 0;
  return base + extra;
}

function parseModSuffix(s: string, prof: number, data: ResolveDiceChar): number | null {
  let i = 0;
  let sum = 0;
  let consumed = false;
  while (i < s.length) {
    const ch = s[i];
    if (ch !== "+" && ch !== "-") {
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (/[A-Za-z]/.test(ch)) return null;
      i++;
      continue;
    }
    const sign = ch === "-" ? -1 : 1;
    i++;
    const rest = s.slice(i);
    if (rest.length === 0) return null;
    const upRest = rest.toUpperCase();
    if (upRest.startsWith("PB")) {
      sum += sign * prof;
      i += 2;
      consumed = true;
      continue;
    }
    let abHit: Ability | null = null;
    for (const ab of ABILITIES) {
      if (upRest.startsWith(ab.toUpperCase())) {
        abHit = ab;
        break;
      }
    }
    if (abHit) {
      sum += sign * abilityMod(totalAbility(data.abilities, data.abilityRacialBonus, abHit));
      i += abHit.length;
      consumed = true;
      continue;
    }
    const m = /^(\d+)/.exec(rest);
    if (m) {
      sum += sign * parseInt(m[1], 10);
      i += m[1].length;
      consumed = true;
      continue;
    }
    return null;
  }
  return consumed || s.length === 0 ? sum : null;
}

/**
 * Convierte expresiones que el DM puede enviar (p. ej. 1d20+INT+PB) en algo que entiende `rollExpression` (NdM±número).
 */
export function resolveDmDiceExpression(raw: string, prof: number, data: ResolveDiceChar): string {
  const trimmed = raw.trim().replace(/\s+/g, "");
  const head = /^(\d+)d(\d+)/i.exec(trimmed);
  if (!head) return trimmed;
  const n = head[1];
  const sides = head[2];
  const tail = trimmed.slice(head[0].length);
  if (!tail) return `${n}d${sides}`;
  const sum = parseModSuffix(tail, prof, data);
  if (sum === null) return trimmed;
  if (sum === 0) return `${n}d${sides}`;
  return `${n}d${sides}${sum > 0 ? `+${sum}` : `${sum}`}`;
}

/** True si el sufijo (tras NdM) se pudo interpretar solo con PB, atributos y dígitos. */
export function canResolveDmDiceExpression(raw: string, prof: number, data: ResolveDiceChar): boolean {
  const trimmed = raw.trim().replace(/\s+/g, "");
  const head = /^(\d+)d(\d+)/i.exec(trimmed);
  if (!head) return false;
  const tail = trimmed.slice(head[0].length);
  if (!tail) return true;
  return parseModSuffix(tail, prof, data) !== null;
}
