import type { BattleMap } from "@/lib/battle-map-types";

const KEY = (x: number, y: number) => `${x},${y}`;

/** Celdas ocupadas por obstáculos (rectángulos en celdas de rejilla). */
export function obstacleBlockedCells(map: BattleMap): Set<string> {
  const blocked = new Set<string>();
  const cols = Math.max(1, map.grid.cols);
  const rows = Math.max(1, map.grid.rows);
  for (const ob of map.obstacles ?? []) {
    const w = Math.max(1, ob.w ?? 1);
    const h = Math.max(1, ob.h ?? 1);
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        const x = ob.x + dx;
        const y = ob.y + dy;
        if (x >= 0 && x < cols && y >= 0 && y < rows) blocked.add(KEY(x, y));
      }
    }
  }
  return blocked;
}

/** Ocupación por fichas distintas del que se mueve (bloquean el destino y el paso en v1). */
export function participantBlockedCells(map: BattleMap, movingParticipantId: string): Set<string> {
  const blocked = new Set<string>();
  for (const p of map.participants) {
    if (p.id === movingParticipantId) continue;
    blocked.add(KEY(p.x, p.y));
  }
  return blocked;
}

function allBlocked(map: BattleMap, movingParticipantId: string): Set<string> {
  const u = new Set(obstacleBlockedCells(map));
  for (const k of participantBlockedCells(map, movingParticipantId)) u.add(k);
  return u;
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** BFS 4 direcciones; cada paso cuesta `stepFeet`. Devuelve coste en pies o null si no hay camino. */
export function movementCostFeet(
  map: BattleMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
  movingParticipantId: string
): number | null {
  const cols = Math.max(1, map.grid.cols);
  const rows = Math.max(1, map.grid.rows);
  const stepFeet = Math.max(1, map.grid.cellFeet ?? 5);
  const blocked = allBlocked(map, movingParticipantId);

  if (to.x < 0 || to.x >= cols || to.y < 0 || to.y >= rows) return null;
  if (blocked.has(KEY(to.x, to.y))) return null;

  const startKey = KEY(from.x, from.y);
  const queue: Array<{ x: number; y: number; dist: number }> = [{ x: from.x, y: from.y, dist: 0 }];
  const seen = new Map<string, number>();
  seen.set(startKey, 0);

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return cur.dist * stepFeet;

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nk = KEY(nx, ny);
      if (blocked.has(nk)) continue;
      const nextDist = cur.dist + 1;
      const prev = seen.get(nk);
      if (prev !== undefined && prev <= nextDist) continue;
      seen.set(nk, nextDist);
      queue.push({ x: nx, y: ny, dist: nextDist });
    }
  }
  return null;
}

/** Celdas alcanzables con coste total en pies <= maxFeet (incluye la celda de origen). */
export function reachableCells(
  map: BattleMap,
  from: { x: number; y: number },
  maxFeet: number,
  movingParticipantId: string
): Set<string> {
  const out = new Set<string>();
  const cols = Math.max(1, map.grid.cols);
  const rows = Math.max(1, map.grid.rows);
  const stepFeet = Math.max(1, map.grid.cellFeet ?? 5);
  const maxSteps = Math.floor(maxFeet / stepFeet);
  const blocked = allBlocked(map, movingParticipantId);

  const queue: Array<{ x: number; y: number; dist: number }> = [{ x: from.x, y: from.y, dist: 0 }];
  const seen = new Map<string, number>();
  seen.set(KEY(from.x, from.y), 0);
  out.add(KEY(from.x, from.y));

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.dist >= maxSteps) continue;

    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const nk = KEY(nx, ny);
      if (blocked.has(nk)) continue;
      const nextDist = cur.dist + 1;
      if (nextDist > maxSteps) continue;
      const prev = seen.get(nk);
      if (prev !== undefined && prev <= nextDist) continue;
      seen.set(nk, nextDist);
      out.add(nk);
      queue.push({ x: nx, y: ny, dist: nextDist });
    }
  }
  return out;
}
