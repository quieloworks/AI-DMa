import { getDb } from "@/lib/db";
import { getIo } from "../io-bus";

type HpChange = { player_id?: string; delta?: number; reason?: string };
type ItemChange = { player_id?: string; name?: string; qty?: number };
type StatusEffect = { player_id?: string; effect?: string; add?: boolean };
type XpAward = { player_id?: string; amount?: number };
type SpellSlotChange = { player_id?: string; level?: number; delta?: number };

type Actions = Record<string, unknown>;

type CharData = {
  hp?: { current?: number; max?: number; temp?: number };
  equipment?: Array<{ name: string; qty: number }>;
  statusEffects?: string[];
  xp?: number;
  level?: number;
  spells?: { slots?: Record<string, { max: number; used: number }> };
};

type PlayerRow = { player_id: string; character_id: string };

function resolveTargets(all: PlayerRow[], rawId: string | undefined): PlayerRow[] {
  if (!rawId) return [];
  if (rawId === "all") return all;
  if (rawId.startsWith("npc:")) return [];
  const byPlayer = all.find((p) => p.player_id === rawId);
  if (byPlayer) return [byPlayer];
  const byCharacter = all.find((p) => p.character_id === rawId);
  if (byCharacter) return [byCharacter];
  return [];
}

function emitCharacterUpdate(
  sessionId: string,
  playerId: string,
  characterId: string,
  patch: Record<string, unknown>
) {
  const io = getIo();
  if (!io) return;
  io.to(`session:${sessionId}`).emit("character:update", { sessionId, playerId, characterId, patch });
}

export function applyDmActions(sessionId: string, actions: Actions): void {
  const db = getDb();
  const players = db
    .prepare<string, PlayerRow>("SELECT player_id, character_id FROM session_player WHERE session_id = ?")
    .all(sessionId);

  const hpChanges = Array.isArray(actions.hp_changes) ? (actions.hp_changes as HpChange[]) : [];
  const itemsAdd = Array.isArray(actions.items_add) ? (actions.items_add as ItemChange[]) : [];
  const itemsRemove = Array.isArray(actions.items_remove) ? (actions.items_remove as ItemChange[]) : [];
  const statusEffects = Array.isArray(actions.status_effects) ? (actions.status_effects as StatusEffect[]) : [];
  const xpAwards = Array.isArray(actions.xp_awards) ? (actions.xp_awards as XpAward[]) : [];
  const slotChanges = Array.isArray(actions.spell_slots) ? (actions.spell_slots as SpellSlotChange[]) : [];

  const touched = new Map<string, { playerId: string; characterId: string; data: CharData; patch: Record<string, unknown> }>();
  const queue = (pid: string, cid: string) => {
    if (!touched.has(cid)) {
      const row = db.prepare<string, { data_json: string }>("SELECT data_json FROM character WHERE id = ?").get(cid);
      if (!row) return null;
      touched.set(cid, { playerId: pid, characterId: cid, data: JSON.parse(row.data_json) as CharData, patch: {} });
    }
    return touched.get(cid)!;
  };

  for (const h of hpChanges) {
    if (typeof h.delta !== "number") continue;
    for (const t of resolveTargets(players, h.player_id)) {
      const rec = queue(t.player_id, t.character_id);
      if (!rec) continue;
      const hp = { current: rec.data.hp?.current ?? 0, max: rec.data.hp?.max ?? 0, temp: rec.data.hp?.temp ?? 0 };
      let delta = h.delta;
      if (delta < 0 && hp.temp > 0) {
        const absorbed = Math.min(hp.temp, -delta);
        hp.temp -= absorbed;
        delta += absorbed;
      }
      hp.current = Math.max(0, Math.min(hp.max, hp.current + delta));
      rec.data.hp = hp;
      rec.patch.hp = hp;
    }
  }

  for (const it of itemsAdd) {
    if (!it.name) continue;
    const qty = Math.max(1, it.qty ?? 1);
    for (const t of resolveTargets(players, it.player_id)) {
      const rec = queue(t.player_id, t.character_id);
      if (!rec) continue;
      const eq = rec.data.equipment ?? [];
      const existing = eq.find((e) => e.name.toLowerCase() === it.name!.toLowerCase());
      if (existing) existing.qty = (existing.qty ?? 1) + qty;
      else eq.push({ name: it.name, qty });
      rec.data.equipment = eq;
      rec.patch.equipment = eq;
    }
  }

  for (const it of itemsRemove) {
    if (!it.name) continue;
    const qty = Math.max(1, it.qty ?? 1);
    for (const t of resolveTargets(players, it.player_id)) {
      const rec = queue(t.player_id, t.character_id);
      if (!rec) continue;
      const eq = rec.data.equipment ?? [];
      const idx = eq.findIndex((e) => e.name.toLowerCase() === it.name!.toLowerCase());
      if (idx >= 0) {
        eq[idx].qty = (eq[idx].qty ?? 1) - qty;
        if (eq[idx].qty <= 0) eq.splice(idx, 1);
        rec.data.equipment = eq;
        rec.patch.equipment = eq;
      }
    }
  }

  for (const s of statusEffects) {
    if (!s.effect) continue;
    for (const t of resolveTargets(players, s.player_id)) {
      const rec = queue(t.player_id, t.character_id);
      if (!rec) continue;
      const list = rec.data.statusEffects ?? [];
      const has = list.some((e) => e.toLowerCase() === s.effect!.toLowerCase());
      if (s.add && !has) list.push(s.effect);
      if (!s.add && has) {
        const idx = list.findIndex((e) => e.toLowerCase() === s.effect!.toLowerCase());
        list.splice(idx, 1);
      }
      rec.data.statusEffects = list;
      rec.patch.statusEffects = list;
    }
  }

  for (const x of xpAwards) {
    if (typeof x.amount !== "number") continue;
    for (const t of resolveTargets(players, x.player_id)) {
      const rec = queue(t.player_id, t.character_id);
      if (!rec) continue;
      rec.data.xp = (rec.data.xp ?? 0) + x.amount;
      rec.patch.xp = rec.data.xp;
    }
  }

  for (const s of slotChanges) {
    if (typeof s.level !== "number" || typeof s.delta !== "number") continue;
    for (const t of resolveTargets(players, s.player_id)) {
      const rec = queue(t.player_id, t.character_id);
      if (!rec) continue;
      const slots = rec.data.spells?.slots ?? {};
      const key = String(s.level);
      const slot = slots[key];
      if (!slot) continue;
      slot.used = Math.max(0, Math.min(slot.max, slot.used + s.delta));
      if (!rec.data.spells) rec.data.spells = { slots };
      rec.data.spells.slots = slots;
      rec.patch.spells = rec.data.spells;
    }
  }

  const now = Date.now();
  for (const rec of touched.values()) {
    if (Object.keys(rec.patch).length === 0) continue;
    db.prepare("UPDATE character SET data_json = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(rec.data),
      now,
      rec.characterId
    );
    emitCharacterUpdate(sessionId, rec.playerId, rec.characterId, rec.patch);
  }

  const io = getIo();
  if (io) {
    const rawRevoke = actions.dice_revoke;
    if (Array.isArray(rawRevoke) && rawRevoke.length) {
      const requestIds = (rawRevoke as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0);
      if (requestIds.length) {
        io.to(`session:${sessionId}`).emit("dice:revoke", { sessionId, requestIds });
      }
    }

    const diceRequests = Array.isArray(actions.dice_requests) ? (actions.dice_requests as Array<Record<string, unknown>>) : [];
    if (diceRequests.length) {
      const normalized = diceRequests
        .map((r) => ({
          id: typeof r.id === "string" ? (r.id as string) : Math.random().toString(36).slice(2),
          playerId: typeof r.player_id === "string" ? (r.player_id as string) : "all",
          expression: typeof r.expression === "string" ? (r.expression as string) : "",
          label: typeof r.label === "string" ? (r.label as string) : undefined,
          dc: typeof r.dc === "number" ? (r.dc as number) : undefined,
        }))
        .filter((r) => r.expression);
      if (normalized.length) {
        const grouped = new Map<string, typeof normalized>();
        for (const r of normalized) {
          const key = r.playerId;
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key)!.push(r);
        }
        for (const [target, reqs] of grouped.entries()) {
          const envelope = { sessionId, targets: [target], requests: reqs };
          if (target === "all") {
            io.to(`session:${sessionId}`).emit("dice:request", envelope);
          } else if (target.startsWith("npc:")) {
            io.to(`session:${sessionId}:dm`).emit("dice:request", envelope);
          } else {
            const exists = players.some((p) => p.player_id === target);
            if (exists) {
              io.to(`player:${sessionId}:${target}`).emit("dice:request", envelope);
              io.to(`session:${sessionId}:dm`).emit("dice:request", envelope);
            } else {
              io.to(`session:${sessionId}`).emit("dice:request", envelope);
            }
          }
        }
      }
    }
  }
}
