export type DiceResult = {
  expression: string;
  rolls: number[];
  modifier: number;
  total: number;
  breakdown: string;
};

export function rollDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

const RE = /^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i;

export function rollExpression(expr: string): DiceResult {
  const m = RE.exec(expr.trim());
  if (!m) throw new Error(`Expresión inválida: ${expr}`);
  const n = Math.min(50, Math.max(1, parseInt(m[1], 10)));
  const d = Math.max(2, parseInt(m[2], 10));
  const sign = m[3] === "-" ? -1 : 1;
  const mod = m[4] ? sign * parseInt(m[4], 10) : 0;
  const rolls = Array.from({ length: n }, () => rollDie(d));
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return {
    expression: `${n}d${d}${mod ? (mod > 0 ? `+${mod}` : `${mod}`) : ""}`,
    rolls,
    modifier: mod,
    total,
    breakdown: `[${rolls.join(", ")}]${mod ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ""} = ${total}`,
  };
}

export function roll4d6DropLowest(): number {
  const rolls = [rollDie(6), rollDie(6), rollDie(6), rollDie(6)];
  rolls.sort((a, b) => b - a);
  return rolls[0] + rolls[1] + rolls[2];
}

export function rollWithAdvantage(sides = 20, mod = 0): DiceResult {
  const a = rollDie(sides);
  const b = rollDie(sides);
  const pick = Math.max(a, b);
  return {
    expression: `1d${sides} adv ${mod >= 0 ? `+${mod}` : mod}`,
    rolls: [a, b],
    modifier: mod,
    total: pick + mod,
    breakdown: `[${a}, ${b}] -> ${pick}${mod ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ""} = ${pick + mod}`,
  };
}

export function rollWithDisadvantage(sides = 20, mod = 0): DiceResult {
  const a = rollDie(sides);
  const b = rollDie(sides);
  const pick = Math.min(a, b);
  return {
    expression: `1d${sides} dis ${mod >= 0 ? `+${mod}` : mod}`,
    rolls: [a, b],
    modifier: mod,
    total: pick + mod,
    breakdown: `[${a}, ${b}] -> ${pick}${mod ? (mod > 0 ? ` + ${mod}` : ` - ${Math.abs(mod)}`) : ""} = ${pick + mod}`,
  };
}
