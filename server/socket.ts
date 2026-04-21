import type { Server as IOServer, Socket } from "socket.io";
import { getDb } from "@/lib/db";
import { rollExpression } from "./dice";

type JoinPayload = { sessionId: string; role: "dm" | "player"; playerId?: string; token?: string; name?: string };

type ChatPayload = {
  sessionId: string;
  role: "dm" | "player";
  playerId?: string;
  kind?: "public" | "private" | "dm-assistant";
  text: string;
  clientId?: string;
};

type StateUpdate = { sessionId: string; patch: Record<string, unknown> };

type DiceRollEvent = {
  sessionId: string;
  by: { role: "dm" | "player"; playerId?: string; label?: string };
  expression: string;
  requestId?: string;
};

type DiceRequest = {
  sessionId: string;
  targets: string[];
  requests: Array<{ id?: string; playerId?: string; expression: string; label?: string; dc?: number }>;
};

type CharacterUpdate = {
  sessionId: string;
  playerId: string;
  characterId: string;
  patch: Record<string, unknown>;
};

export function registerSocketHandlers(io: IOServer) {
  io.on("connection", (socket: Socket) => {
    let boundSession: string | null = null;
    let boundRole: "dm" | "player" | null = null;
    let boundPlayer: string | null = null;

    socket.on("session:join", (payload: JoinPayload, cb?: (r: { ok: boolean; error?: string }) => void) => {
      try {
        const db = getDb();
        const session = db.prepare<string, { id: string }>("SELECT id FROM session WHERE id = ?").get(payload.sessionId);
        if (!session) return cb?.({ ok: false, error: "Sesión no existe" });

        if (payload.role === "player") {
          if (!payload.playerId || !payload.token) return cb?.({ ok: false, error: "Falta token" });
          const row = db
            .prepare<[string, string], { token: string }>("SELECT token FROM session_player WHERE session_id = ? AND player_id = ?")
            .get(payload.sessionId, payload.playerId);
          if (!row || row.token !== payload.token) return cb?.({ ok: false, error: "Token inválido" });
          db.prepare("UPDATE session_player SET connected = 1 WHERE session_id = ? AND player_id = ?").run(payload.sessionId, payload.playerId);
          socket.join(`player:${payload.sessionId}:${payload.playerId}`);
          boundPlayer = payload.playerId;
        }

        socket.join(`session:${payload.sessionId}`);
        if (payload.role === "dm") socket.join(`session:${payload.sessionId}:dm`);
        boundSession = payload.sessionId;
        boundRole = payload.role;

        io.to(`session:${payload.sessionId}`).emit("presence", { role: payload.role, playerId: payload.playerId, joined: true });
        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, error: (err as Error).message });
      }
    });

    socket.on("chat:send", (msg: ChatPayload) => {
      if (!msg.sessionId) return;
      const db = getDb();
      db.prepare(
        `INSERT INTO session_message(session_id, role, player_id, kind, content, created_at) VALUES(?, ?, ?, ?, ?, ?)`
      ).run(msg.sessionId, msg.role, msg.playerId ?? null, msg.kind ?? "public", msg.text, Date.now());

      const payload = { ...msg, originClientId: msg.clientId };

      if (msg.kind === "private" && msg.playerId) {
        socket.to(`session:${msg.sessionId}:dm`).emit("chat:message", payload);
        socket.to(`player:${msg.sessionId}:${msg.playerId}`).emit("chat:message", payload);
        return;
      }
      if (msg.kind === "dm-assistant") {
        socket.to(`session:${msg.sessionId}:dm`).emit("chat:message", payload);
        return;
      }
      socket.to(`session:${msg.sessionId}`).emit("chat:message", payload);
    });

    socket.on("state:update", (evt: StateUpdate) => {
      io.to(`session:${evt.sessionId}`).emit("state:update", evt.patch);
    });

    socket.on("dice:roll", (evt: DiceRollEvent) => {
      try {
        const result = rollExpression(evt.expression);
        io.to(`session:${evt.sessionId}`).emit("dice:result", { by: evt.by, result, requestId: evt.requestId });
      } catch (err) {
        socket.emit("dice:error", { message: (err as Error).message });
      }
    });

    socket.on(
      "dice:report",
      (evt: {
        sessionId: string;
        by: DiceRollEvent["by"];
        expression: string;
        total: number;
        rolls: number[];
        requestId?: string;
        breakdown?: string;
      }) => {
        const breakdown =
          typeof evt.breakdown === "string" && evt.breakdown.trim()
            ? evt.breakdown.trim()
            : `[${evt.rolls.join(", ")}] = ${evt.total} (manual)`;
        io.to(`session:${evt.sessionId}`).emit("dice:result", {
          by: evt.by,
          requestId: evt.requestId,
          result: {
            expression: evt.expression,
            total: evt.total,
            rolls: evt.rolls,
            modifier: 0,
            breakdown,
          },
        });
      }
    );

    socket.on("dice:request", (evt: DiceRequest) => {
      if (!evt.sessionId || !Array.isArray(evt.requests) || !evt.requests.length) return;
      const targets = evt.targets && evt.targets.length ? evt.targets : evt.requests.map((r) => r.playerId || "all");
      for (const t of new Set(targets)) {
        if (t === "all") {
          io.to(`session:${evt.sessionId}`).emit("dice:request", { sessionId: evt.sessionId, targets: ["all"], requests: evt.requests });
        } else if (t.startsWith("npc:")) {
          io.to(`session:${evt.sessionId}:dm`).emit("dice:request", {
            sessionId: evt.sessionId,
            targets: [t],
            requests: evt.requests.filter((r) => r.playerId === t),
          });
        } else {
          const reqs = evt.requests.filter((r) => r.playerId === t || r.playerId === "all");
          io.to(`player:${evt.sessionId}:${t}`).emit("dice:request", { sessionId: evt.sessionId, targets: [t], requests: reqs });
          io.to(`session:${evt.sessionId}:dm`).emit("dice:request", { sessionId: evt.sessionId, targets: [t], requests: reqs });
        }
      }
    });

    socket.on("character:update", (evt: CharacterUpdate) => {
      if (!evt.sessionId || !evt.playerId) return;
      io.to(`session:${evt.sessionId}`).emit("character:update", evt);
    });

    socket.on("disconnect", () => {
      if (boundSession && boundRole === "player" && boundPlayer) {
        getDb().prepare("UPDATE session_player SET connected = 0 WHERE session_id = ? AND player_id = ?").run(boundSession, boundPlayer);
        io.to(`session:${boundSession}`).emit("presence", { role: "player", playerId: boundPlayer, joined: false });
      }
    });
  });
}
