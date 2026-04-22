"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import {
  canResolveDmDiceExpression,
  resolveDmDiceExpression,
} from "@/lib/dm-dice-expression";
import { useLocale, useTranslations } from "@/components/LocaleProvider";
import { localizeGamePhrase, localizedAbilityAbbrev, localizedSkillLabel } from "@/lib/i18n/game-localize";

type Ability = "fue" | "des" | "con" | "int" | "sab" | "car";

type CharData = {
  abilities?: Record<Ability, number>;
  abilityRacialBonus?: Partial<Record<Ability, number>>;
  skills?: string[];
  savingThrows?: Ability[];
  hp?: { current: number; max: number; temp: number; hitDie?: number };
  ac?: number;
  speed?: number;
  initiativeBonus?: number;
  proficiencies?: { weapons?: string[]; armor?: string[]; tools?: string[]; languages?: string[] };
  equipment?: Array<{ name: string; qty: number; damage?: string; kind?: string }>;
  money?: { cp: number; sp: number; ep: number; gp: number; pp: number };
  spells?: {
    ability?: Ability;
    known?: Array<{ name: string; level: number; prepared: boolean }>;
    slots?: Record<string, { max: number; used: number }>;
  };
  statusEffects?: string[];
  xp?: number;
};

type Player = {
  player_id: string;
  token: string;
  character: { name: string; class: string | null; race: string | null; level: number; data: CharData } | null;
};

type Tab = "personaje" | "acciones" | "chat" | "dados";

/** Grupo: crónica compartida. Privado: solo susurros DM↔este jugador (no mezclar con la narración). */
type ChatSubTab = "group" | "private";

type ChatMsg = { id: string; from: "dm" | "me" | "system"; text: string; kind: "public" | "private" };

type DiceResult = { label?: string; expression: string; total: number; breakdown: string };

type DiceRequest = { id: string; playerId: string; expression: string; label?: string; dc?: number };

const ABILITIES_ORDER: Ability[] = ["fue", "des", "con", "int", "sab", "car"];

const SKILL_ABILITY: Record<string, Ability> = {
  acrobacias: "des",
  "trato con animales": "sab",
  arcanos: "int",
  atletismo: "fue",
  engaño: "car",
  historia: "int",
  perspicacia: "sab",
  intimidación: "car",
  investigación: "int",
  medicina: "sab",
  naturaleza: "int",
  percepción: "sab",
  interpretación: "car",
  persuasión: "car",
  religión: "int",
  "juego de manos": "des",
  sigilo: "des",
  supervivencia: "sab",
};

/** Match weapon-like gear by Spanish or English names (equipment may be either language). */
const WEAPON_NAME_PATTERN =
  /espada|hacha|arco|daga|maza|lanza|martillo|ballesta|bast(ó|o)n|jabalina|cimitarra|garrote|rapiera|honda|sword|axe|bows?|dagger|mace|spear|hammers?|crossbows?|staff|quarterstaff|javelin|scimitar|clubs?|rapier|sling|wands?|battleaxe|greatsword|longbow|shortbow|handaxe|greataxe|longsword|shortsword|tridents?|whips?|flails?|morningstars?|darts?|warhammer|greatclub|halberds?|glaives?|pikes?|lances?|nets?\b|shields?|sickles?|mauls?|picks?|blowguns?|yklwas?|hand\s*crossbow|light\s*crossbow|heavy\s*crossbow/i;

const CONSUMABLE_NAME_PATTERN =
  /poci(ó|o)n|antorcha|tienda|raci(ó|o)n|cuerda|ganz(ú|u)a|potion|torch|tent|tents?|rations?|ropes?|crowbars?|acids?|oils?|poisons?|antitoxin|alchemist|burglar|flasks?|vials?|kits?|gear|supplies/i;

function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

function profBonus(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function totalAbility(abilities: CharData["abilities"], racial: CharData["abilityRacialBonus"], a: Ability): number {
  const base = abilities?.[a] ?? 10;
  const extra = racial?.[a] ?? 0;
  return base + extra;
}

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function PlayRoom({
  sessionId,
  storyTitle,
  storyMode,
  players,
  initialPlayerId,
  initialToken,
  initialCombat = false,
}: {
  sessionId: string;
  storyTitle: string;
  storyMode: "auto" | "assistant";
  players: Player[];
  initialPlayerId?: string;
  initialToken?: string;
  initialCombat?: boolean;
}) {
  const tr = useTranslations();
  const clientIdRef = useRef<string>(Math.random().toString(36).slice(2) + Date.now().toString(36));
  const socketRef = useRef<Socket | null>(null);
  const rollCtxRef = useRef({
    prof: 2,
    data: {} as CharData,
    playerId: "",
    sessionId: "",
  });
  const [picked, setPicked] = useState<Player | null>(() => {
    if (initialPlayerId && initialToken) {
      const found = players.find((p) => p.player_id === initialPlayerId && p.token === initialToken);
      if (found) return found;
    }
    return null;
  });
  const [currentData, setCurrentData] = useState<CharData>(() => picked?.character?.data ?? {});
  const [tab, setTab] = useState<Tab>("personaje");
  const [chatSubTab, setChatSubTab] = useState<ChatSubTab>("group");
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [recentRolls, setRecentRolls] = useState<DiceResult[]>([]);
  const [pendingDice, setPendingDice] = useState<DiceRequest[]>([]);
  const [selectedDice, setSelectedDice] = useState<string>("1d20");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [diceModifier, setDiceModifier] = useState<number>(0);
  const [dmThinking, setDmThinking] = useState(false);
  const [inCombat, setInCombat] = useState(initialCombat);
  const [actionToast, setActionToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const flashToast = useCallback((text: string) => {
    setActionToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setActionToast(null), 2200);
  }, []);

  useEffect(() => {
    if (picked?.character?.data) setCurrentData(picked.character.data);
  }, [picked]);

  const hp = currentData.hp ?? { current: 0, max: 0, temp: 0 };
  const ac = currentData.ac ?? 10;
  const speed = currentData.speed ?? 30;
  const level = picked?.character?.level ?? 1;
  const prof = profBonus(level);
  const statusEffects = currentData.statusEffects ?? [];

  rollCtxRef.current = {
    prof,
    data: currentData,
    playerId: picked?.player_id ?? "",
    sessionId,
  };

  useEffect(() => {
    if (!picked) return;
    const s = io({ path: "/socket.io", query: { clientId: clientIdRef.current } });
    s.on("connect", () => {
      s.emit("session:join", {
        sessionId,
        role: "player",
        playerId: picked.player_id,
        token: picked.token,
        name: picked.character?.name,
      });
    });

    s.on(
      "chat:message",
      (msg: { role: string; text: string; kind?: string; playerId?: string; originClientId?: string }) => {
        if (msg.kind === "dm-assistant") return;
        if (msg.originClientId === clientIdRef.current) return;
        const mine = msg.playerId === picked.player_id;
        if (msg.kind === "private") {
          if (msg.role === "dm") {
            if (msg.playerId !== picked.player_id) return;
          } else if (!mine) {
            return;
          }
        }
        setChat((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            from: msg.role === "dm" ? "dm" : mine ? "me" : "dm",
            text: msg.text,
            kind: (msg.kind as "public" | "private") ?? "public",
          },
        ]);
        if (msg.role === "dm") setDmThinking(false);
      }
    );

    s.on(
      "dice:result",
      (evt: {
        by: { playerId?: string; role: string; label?: string };
        result: DiceResult;
        requestId?: string;
      }) => {
        setRecentRolls((prev) => [evt.result, ...prev].slice(0, 12));
        const mine = evt.by.playerId === picked.player_id;
        if (mine && evt.requestId) {
          setChat((prev) => [
            ...prev,
            {
              id: Math.random().toString(36).slice(2),
              from: "system",
              text: `🎲 ${evt.result.expression}${evt.by.label ? ` (${evt.by.label})` : ""}: ${evt.result.breakdown}`,
              kind: "public",
            },
          ]);
        }
        if (evt.requestId && mine) {
          setPendingDice((prev) => {
            const cur = prev.find((r) => r.id === evt.requestId);
            if (!cur) return prev;
            const dc = cur.dc;
            const passed = typeof dc !== "number" || evt.result.total >= dc;
            if (!passed) {
              flashToast(tr("play.diceDcFailToast", { total: evt.result.total, dc }));
              return prev;
            }
            const next = prev.filter((r) => r.id !== evt.requestId);
            const head = next[0];
            if (
              head &&
              canResolveDmDiceExpression(head.expression, rollCtxRef.current.prof, rollCtxRef.current.data)
            ) {
              queueMicrotask(() => {
                const s2 = socketRef.current;
                const c2 = rollCtxRef.current;
                if (!s2 || !c2.playerId) return;
                const h2 = head;
                const expr = resolveDmDiceExpression(h2.expression, c2.prof, c2.data);
                s2.emit("dice:roll", {
                  sessionId: c2.sessionId,
                  by: {
                    role: "player",
                    playerId: c2.playerId,
                    label: h2.label ?? tr("play.diceDmRequested"),
                  },
                  expression: expr,
                  requestId: h2.id,
                });
              });
            }
            return next;
          });
        } else if (evt.requestId) {
          setPendingDice((prev) => prev.filter((r) => r.id !== evt.requestId));
        }
      }
    );

    s.on("dice:error", (evt: { message?: string }) => {
      flashToast(evt.message ?? tr("play.diceInvalidRoll"));
    });

    s.on("dice:revoke", (evt: { sessionId: string; requestIds: string[] }) => {
      if (evt.sessionId !== sessionId || !Array.isArray(evt.requestIds)) return;
      setPendingDice((prev) => prev.filter((r) => !evt.requestIds.includes(r.id)));
    });

    s.on(
      "scene:update",
      (evt: { sessionId: string; combat?: boolean }) => {
        if (evt.sessionId !== sessionId) return;
        if (typeof evt.combat === "boolean") setInCombat(evt.combat);
      }
    );

    s.on("dice:request", (evt: { requests: Array<Omit<DiceRequest, "id"> & { id?: string }> }) => {
      const norm = evt.requests.map((r) => ({
        id: r.id ?? Math.random().toString(36).slice(2),
        playerId: r.playerId,
        expression: r.expression,
        label: r.label,
        dc: r.dc,
      }));
      setPendingDice((prev) => [...prev, ...norm].slice(0, 6));
      setTab("dados");
    });

    s.on("character:update", (evt: { playerId: string; patch: Partial<CharData> }) => {
      if (evt.playerId !== picked.player_id) return;
      setCurrentData((prev) => ({ ...prev, ...evt.patch }));
    });

    socketRef.current = s;
    return () => {
      socketRef.current = null;
      s.disconnect();
    };
  }, [picked, sessionId, flashToast, tr]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, tab, chatSubTab]);

  const triggerDm = useCallback(
    async (text: string, opts?: { sceneInfoRequest?: boolean }) => {
      if (!picked) return;
      if (storyMode !== "auto") return;
      setDmThinking(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            mode: "auto",
            action: "player",
            playerId: picked.player_id,
            playerName: picked.character?.name ?? tr("errors.playerDefault"),
            text,
            sceneInfoRequest: opts?.sceneInfoRequest === true,
            clientId: clientIdRef.current,
          }),
        });
        if (!res.body) throw new Error(tr("play.streamError"));
        const reader = res.body.getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      } catch (err) {
        setChat((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            from: "system",
            text: tr("play.dmNoResponse", { msg: (err as Error).message }),
            kind: "public",
          },
        ]);
        setDmThinking(false);
      }
    },
    [picked, sessionId, storyMode, tr]
  );

  const sendChat = useCallback(
    (
      text: string,
      kind: "public" | "private" = "public",
      options?: { triggerDm?: boolean; sceneInfoRequest?: boolean }
    ) => {
      const trimmed = text.trim();
      if (!trimmed || !picked) return;
      const s = socketRef.current;
      if (!s) return;
      s.emit("chat:send", {
        sessionId,
        role: "player",
        playerId: picked.player_id,
        kind,
        text: trimmed,
        clientId: clientIdRef.current,
      });
      setChat((prev) => [
        ...prev,
        { id: Math.random().toString(36).slice(2), from: "me", text: trimmed, kind },
      ]);
      if (options?.triggerDm && kind === "public") {
        void triggerDm(trimmed, options.sceneInfoRequest ? { sceneInfoRequest: true } : undefined);
      }
    },
    [picked, sessionId, triggerDm]
  );

  const roll = useCallback(
    (expression: string, label?: string, requestId?: string) => {
      if (!picked) return;
      const s = socketRef.current;
      if (!s) return;
      s.emit("dice:roll", {
        sessionId,
        by: { role: "player", playerId: picked.player_id, label },
        expression,
        requestId,
      });
    },
    [picked, sessionId]
  );

  const groupChat = useMemo(() => chat.filter((m) => m.kind === "public"), [chat]);
  const privateChat = useMemo(() => chat.filter((m) => m.kind === "private"), [chat]);

  const handleSendInput = useCallback(
    (kind: "public" | "private" = "public") => {
      if (!input.trim()) return;
      const effectiveKind = tab === "chat" && chatSubTab === "private" ? "private" : kind;
      sendChat(input, effectiveKind);
      setInput("");
    },
    [input, sendChat, tab, chatSubTab]
  );

  const rollVirtualForActiveRequest = useCallback(() => {
    const head = pendingDice[0];
    if (!head || !picked) return;
    if (!canResolveDmDiceExpression(head.expression, prof, currentData)) {
      flashToast(tr("play.resolveExpressionFail"));
      return;
    }
    const rx = resolveDmDiceExpression(head.expression, prof, currentData);
    roll(rx, head.label ?? tr("play.diceDmRequested"), head.id);
  }, [pendingDice, picked, prof, currentData, roll, flashToast, tr]);

  const rollSelected = useCallback(() => {
    if (pendingDice.length > 0) {
      rollVirtualForActiveRequest();
      return;
    }
    let expr = selectedDice;
    if (diceModifier !== 0 && /^\d+d\d+$/.test(selectedDice)) {
      expr = `${selectedDice}${diceModifier >= 0 ? "+" : ""}${diceModifier}`;
    }
    roll(expr, selectedLabel || undefined);
  }, [pendingDice, rollVirtualForActiveRequest, selectedDice, selectedLabel, diceModifier, roll]);

  const reportManualTotal = useCallback(
    (req: DiceRequest, total: number) => {
      if (!picked) return;
      const s = socketRef.current;
      if (!s) return;
      if (!Number.isFinite(total)) return;
      const breakdown = `Total manual: ${total} (${req.expression}${req.label ? ` · ${req.label}` : ""})`;
      s.emit("dice:report", {
        sessionId,
        by: { role: "player", playerId: picked.player_id, label: req.label ?? tr("play.diceDmRequested") },
        expression: req.expression,
        total,
        rolls: [total],
        requestId: req.id,
        breakdown,
      });
    },
    [picked, sessionId, tr]
  );

  if (!picked) {
    return (
      <div className="min-h-screen grain mesh-bg">
        <div className="mx-auto max-w-md px-5 py-12">
          <p className="label mb-2">{tr("play.joinTitle")}</p>
          <h1 className="mb-6">{storyTitle}</h1>
          <p className="mb-4 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {tr("play.pickCharacter")}
          </p>
          <div className="space-y-3">
            {players.map((p) => (
              <button key={p.player_id} onClick={() => setPicked(p)} className="card block w-full text-left">
                <p>{p.character?.name ?? tr("play.adventurerDefault")}</p>
                <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                  {p.character?.race ?? ""} · {p.character?.class ?? ""} {tr("play.levelAbbrev")}{" "}
                  {p.character?.level ?? 1}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ background: "var(--color-bg-primary)", height: "100dvh" }}
    >
      <header
        className="shrink-0"
        style={{ background: "var(--color-bg-primary)", borderBottom: "0.5px solid var(--color-border)" }}
      >
        <div className="px-4 pb-1 pt-3">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="label" style={{ fontSize: 10 }}>
                {storyTitle}
              </p>
              <h2 style={{ fontSize: 18 }}>{picked.character?.name}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
              <span>
                {tr("storyRoom.hp")} {hp.current}/{hp.max}
              </span>
              <span>·</span>
              <span>
                {tr("play.sheet.acAbbr")} {ac}
              </span>
              <span>·</span>
              <span>{tr("play.speedBanner", { n: speed })}</span>
            </div>
          </div>
          {statusEffects.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {statusEffects.map((e) => (
                <span key={e} className="badge" style={{ fontSize: 10 }}>
                  {e}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex px-2 pb-2 pt-1">
          {(["personaje", "acciones", "chat", "dados"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 rounded-md px-2 py-1.5 text-xs"
              style={{
                color: tab === t ? "var(--color-accent)" : "var(--color-text-hint)",
                background: tab === t ? "var(--color-accent-bg)" : "transparent",
              }}
            >
              {t === "personaje"
                ? tr("play.tabPersonaje")
                : t === "acciones"
                  ? tr("play.tabAcciones")
                  : t === "chat"
                    ? tr("play.tabChat")
                    : tr("play.tabDados")}
              {t === "dados" && pendingDice.length > 0 && (
                <span
                  className="ml-1 inline-block rounded-full"
                  style={{
                    background: "var(--color-accent)",
                    color: "white",
                    padding: "0 6px",
                    fontSize: 10,
                    fontWeight: 500,
                  }}
                >
                  {pendingDice.length}
                </span>
              )}
            </button>
          ))}
        </div>
        {inCombat && storyMode === "auto" && (
          <div className="px-3 pb-2">
            <button
              type="button"
              className="w-full rounded-md py-2 text-xs"
              style={{
                border: "0.5px solid var(--color-border-strong)",
                color: "var(--color-text-secondary)",
                background: "var(--color-bg-tertiary)",
              }}
              onClick={() => {
                sendChat(tr("play.sceneRequestPayload"), "public");
                setTab("chat");
                flashToast(tr("play.sceneToast"));
              }}
            >
              {tr("play.viewSceneBattlefield")}
            </button>
          </div>
        )}
      </header>

      {actionToast && (
        <div
          className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-2 text-xs"
          style={{
            top: 72,
            background: "var(--color-accent)",
            color: "white",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            animation: "fadeUp 0.25s ease both",
            maxWidth: "90%",
          }}
        >
          {actionToast}
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-hidden">
        {tab === "personaje" && (
          <div className="h-full overflow-y-auto px-4 py-4 pb-8">
            <CharacterSheet data={currentData} level={level} prof={prof} />
          </div>
        )}

        {tab === "acciones" && (
          <div className="h-full overflow-y-auto px-4 py-4 pb-8">
            <ActionsPanel
              data={currentData}
              level={level}
              prof={prof}
              onAction={(text) => {
                sendChat(text, "public");
                flashToast(text);
                setTab("chat");
              }}
            />
          </div>
        )}

        {tab === "chat" && (
          <div className="flex h-full flex-col">
            <div
              className="flex shrink-0 gap-1 px-3 pt-2"
              style={{ borderBottom: "0.5px solid var(--color-border)" }}
            >
              <button
                type="button"
                onClick={() => setChatSubTab("group")}
                className="flex-1 rounded-md px-2 py-1.5 text-xs"
                style={{
                  color: chatSubTab === "group" ? "var(--color-accent)" : "var(--color-text-hint)",
                  background: chatSubTab === "group" ? "var(--color-accent-bg)" : "transparent",
                }}
              >
                {tr("play.groupTab")}
                {groupChat.length > 0 && (
                  <span className="ml-1 opacity-70" style={{ fontSize: 10 }}>
                    ({groupChat.length})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setChatSubTab("private")}
                className="flex-1 rounded-md px-2 py-1.5 text-xs"
                style={{
                  color: chatSubTab === "private" ? "var(--color-accent)" : "var(--color-text-hint)",
                  background: chatSubTab === "private" ? "var(--color-accent-bg)" : "transparent",
                }}
              >
                {tr("play.privateTabLabel")}
                {privateChat.length > 0 && (
                  <span className="ml-1 opacity-70" style={{ fontSize: 10 }}>
                    ({privateChat.length})
                  </span>
                )}
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <div className="space-y-2">
                {chatSubTab === "group" && (
                  <>
                    {groupChat.length === 0 && (
                      <p className="text-center text-xs italic" style={{ color: "var(--color-text-hint)" }}>
                        {tr("play.groupChatEmptyHint")}
                      </p>
                    )}
                    {groupChat.map((m) => (
                      <ChatItem key={m.id} m={m} />
                    ))}
                    {dmThinking && (
                      <p className="text-center text-xs italic" style={{ color: "var(--color-text-hint)" }}>
                        {tr("play.dmThinking")}
                      </p>
                    )}
                  </>
                )}
                {chatSubTab === "private" && (
                  <>
                    {privateChat.length === 0 && (
                      <p className="text-center text-xs italic" style={{ color: "var(--color-text-hint)" }}>
                        {tr("play.privateChatEmptyHint")}
                      </p>
                    )}
                    {privateChat.map((m) => (
                      <ChatItem key={m.id} m={m} />
                    ))}
                  </>
                )}
                <div ref={chatEnd} />
              </div>
            </div>
            <div
              className="shrink-0 px-3 py-2"
              style={{ borderTop: "0.5px solid var(--color-border)", background: "var(--color-bg-primary)" }}
            >
              {chatSubTab === "group" ? (
                <div className="flex items-center gap-2">
                  <input
                    className="input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={tr("play.chatPlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendInput("public");
                      }
                    }}
                  />
                  <button
                    className="btn-ghost"
                    onClick={() => handleSendInput("private")}
                    title={tr("play.privateTitle")}
                    style={{ padding: "0 10px" }}
                  >
                    🔒
                  </button>
                  <button className="btn-accent" onClick={() => handleSendInput("public")} disabled={!input.trim()}>
                    ↑
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    className="input w-full"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={tr("play.whisperPlaceholder")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSendInput("private");
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="text-xs"
                      style={{ color: "var(--color-text-hint)" }}
                      onClick={() => setChatSubTab("group")}
                    >
                      {tr("play.backToGroup")}
                    </button>
                    <button
                      className="btn-accent"
                      onClick={() => handleSendInput("private")}
                      disabled={!input.trim()}
                    >
                      {tr("play.sendPrivateShort")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "dados" && (
          <div className="h-full overflow-y-auto px-4 py-3 pb-8">
            <DicePanel
              pending={pendingDice}
              selected={selectedDice}
              selectedLabel={selectedLabel}
              modifier={diceModifier}
              recent={recentRolls}
              data={currentData}
              prof={prof}
              onSelect={(expr, label) => {
                setSelectedDice(expr);
                setSelectedLabel(label ?? "");
              }}
              onModifier={setDiceModifier}
              onRoll={rollSelected}
              onReportManual={reportManualTotal}
              onDismiss={(id) => setPendingDice((prev) => prev.filter((r) => r.id !== id))}
            />
          </div>
        )}
      </main>
    </div>
  );
}

function ChatItem({ m }: { m: ChatMsg }) {
  const tr = useTranslations();
  if (m.from === "system") {
    return (
      <p className="text-center text-xs italic" style={{ color: "var(--color-text-hint)" }}>
        {m.text}
      </p>
    );
  }
  const mine = m.from === "me";
  return (
    <div className={mine ? "flex justify-end" : "flex"}>
      <div
        className="max-w-[85%] rounded-lg px-3 py-2 text-sm"
        style={{
          background: m.kind === "private"
            ? "var(--color-accent-bg)"
            : mine
              ? "var(--color-bg-tertiary)"
              : "var(--color-bg-secondary)",
          border: `0.5px solid ${m.kind === "private" ? "var(--color-accent)" : "var(--color-border)"}`,
          color: "var(--color-text-primary)",
        }}
      >
        {m.kind === "private" && (
          <span className="badge mb-1" style={{ fontSize: 10 }}>
            {mine ? tr("play.chatPrivateToDm") : tr("play.chatDmWhisper")}
          </span>
        )}
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{m.text}</p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md p-3 text-center" style={{ background: "var(--color-bg-tertiary)" }}>
      <p className="label" style={{ fontSize: 10 }}>
        {label}
      </p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 20 }}>{value}</p>
    </div>
  );
}

function CharacterSheet({ data, level, prof }: { data: CharData; level: number; prof: number }) {
  const tr = useTranslations();
  const locale = useLocale();
  const hp = data.hp ?? { current: 0, max: 0, temp: 0 };
  const abilities = data.abilities ?? { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };
  const racial = data.abilityRacialBonus ?? {};
  return (
    <div className="space-y-3">
      <div className="card">
        <p className="label mb-2">{tr("play.sheet.vitals")}</p>
        <div className="grid grid-cols-4 gap-2">
          <Stat label={tr("storyRoom.hp")} value={`${hp.current}/${hp.max}`} />
          <Stat label={tr("play.sheet.acAbbr")} value={data.ac ?? 10} />
          <Stat label={tr("play.sheet.speedAbbr")} value={data.speed ?? 30} />
          <Stat label={tr("play.sheet.pbAbbr")} value={`+${prof}`} />
        </div>
        {hp.temp > 0 && (
          <p className="mt-2 text-xs" style={{ color: "var(--color-accent)" }}>
            {tr("play.sheet.hpTemp", { n: hp.temp })}
          </p>
        )}
      </div>

      <div className="card">
        <p className="label mb-2">{tr("play.sheet.attributes")}</p>
        <div className="grid grid-cols-6 gap-1">
          {ABILITIES_ORDER.map((a) => {
            const total = totalAbility(abilities, racial, a);
            return (
              <div key={a} className="text-center">
                <p className="label" style={{ fontSize: 9 }}>
                  {localizedAbilityAbbrev(a, locale)}
                </p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 16 }}>{total}</p>
                <p className="text-[10px]" style={{ color: "var(--color-text-hint)" }}>
                  {formatMod(abilityMod(total))}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {(data.equipment ?? []).length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("play.sheet.equipment")}</p>
          <ul className="space-y-1 text-sm">
            {(data.equipment ?? []).map((e, i) => (
              <li key={i}>
                · {e.qty > 1 ? e.qty + " × " : ""}
                {localizeGamePhrase(e.name, locale)}
                {e.damage ? <span style={{ color: "var(--color-text-hint)" }}> · {e.damage}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(data.spells?.known?.length ?? 0) > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("play.sheet.spells")}</p>
          <div className="mb-2 flex flex-wrap gap-1">
            {Object.entries(data.spells?.slots ?? {}).map(([lvl, s]) => (
              <span key={lvl} className="badge" style={{ fontSize: 10 }}>
                {tr("play.sheet.slotShort", { lvl })}: {s.max - s.used}/{s.max}
              </span>
            ))}
          </div>
          <ul className="space-y-1 text-sm">
            {(data.spells?.known ?? []).map((s, i) => (
              <li key={i}>
                · [{s.level}] {localizeGamePhrase(s.name, locale)} {s.prepared ? "✔" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-center text-xs" style={{ color: "var(--color-text-hint)" }}>
        {tr("play.sheet.footerLevel", { level, xp: data.xp ?? 0 })}
      </p>
    </div>
  );
}

function ActionsPanel({
  data,
  level,
  prof,
  onAction,
}: {
  data: CharData;
  level: number;
  prof: number;
  onAction: (text: string) => void;
}) {
  const tr = useTranslations();
  const locale = useLocale();
  const abilities = data.abilities ?? { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };
  const racial = data.abilityRacialBonus ?? {};
  const skills = data.skills ?? [];
  const weapons = (data.equipment ?? []).filter((e) => WEAPON_NAME_PATTERN.test(e.name));
  const consumables = (data.equipment ?? []).filter((e) => CONSUMABLE_NAME_PATTERN.test(e.name));
  const spells = data.spells?.known ?? [];

  const rollSkill = (skill: string) => {
    const ability = SKILL_ABILITY[skill.toLowerCase()] ?? "des";
    const mod = abilityMod(totalAbility(abilities, racial, ability)) + prof;
    onAction(
      tr("play.actionTrySkill", {
        skill: localizedSkillLabel(skill.toLowerCase(), locale),
        abl: localizedAbilityAbbrev(ability, locale),
        mod: formatMod(mod),
      }),
    );
  };

  const rollSave = (ability: Ability) => {
    const base = abilityMod(totalAbility(abilities, racial, ability));
    const hasProf = (data.savingThrows ?? []).includes(ability);
    const mod = base + (hasProf ? prof : 0);
    onAction(
      tr("play.actionSave", {
        abl: localizedAbilityAbbrev(ability, locale),
        mod: formatMod(mod),
        profSuffix: hasProf ? tr("play.actionSaveProfSuffix") : "",
      }),
    );
  };

  const attack = (weapon: { name: string; damage?: string }) => {
    const usesDex =
      /arco|ballesta|daga|rapiera|cimitarra|honda|jabalina|bow|crossbow|dagger|rapier|scimitar|sling|shortsword|longsword/i.test(
        weapon.name,
      );
    const ab = usesDex ? "des" : "fue";
    const mod = abilityMod(totalAbility(abilities, racial, ab)) + prof;
    onAction(
      tr("play.actionAttack", {
        weapon: weapon.name,
        mod: formatMod(mod),
        dmgSuffix: weapon.damage ? tr("play.actionAttackDmgSuffix", { dmg: weapon.damage }) : "",
      }),
    );
  };

  const castSpell = (s: { name: string; level: number }) => {
    const levelLabel =
      s.level === 0 ? tr("play.actionCastCantrip") : tr("play.actionCastLevel", { n: s.level });
    onAction(tr("play.actionCastSpell", { name: localizeGamePhrase(s.name, locale), levelLabel }));
  };

  const useItem = (name: string) => {
    onAction(tr("play.actionUseItem", { name: localizeGamePhrase(name, locale) }));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {tr("play.actionsHelp")}
      </p>

      <div className="card">
        <p className="label mb-2">{tr("play.sectionCombat")}</p>
        <div className="grid grid-cols-2 gap-2">
          <ActionTile
            label={tr("play.tileInitiative")}
            subtitle={formatMod(abilityMod(totalAbility(abilities, racial, "des")) + (data.initiativeBonus ?? 0))}
            onClick={() => {
              const mod = abilityMod(totalAbility(abilities, racial, "des")) + (data.initiativeBonus ?? 0);
              onAction(tr("play.actionInitiative", { mod: formatMod(mod) }));
            }}
          />
          <ActionTile
            label={tr("play.tileUnarmed")}
            subtitle={formatMod(abilityMod(totalAbility(abilities, racial, "fue")) + prof)}
            onClick={() => {
              const mod = abilityMod(totalAbility(abilities, racial, "fue")) + prof;
              onAction(tr("play.actionUnarmed", { mod: formatMod(mod) }));
            }}
          />
        </div>
      </div>

      {weapons.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("play.equippedWeapons")}</p>
          <div className="grid grid-cols-1 gap-2">
            {weapons.map((w, i) => {
              const usesDex =
                /arco|ballesta|daga|rapiera|cimitarra|honda|jabalina|bow|crossbow|dagger|rapier|scimitar|sling|shortsword|longsword/i.test(
                  w.name,
                );
              const ab: Ability = usesDex ? "des" : "fue";
              const mod = abilityMod(totalAbility(abilities, racial, ab)) + prof;
              return (
                <ActionTile
                  key={i}
                  label={tr("play.attackWith", { weapon: localizeGamePhrase(w.name, locale) })}
                  subtitle={tr("play.weaponSubtitle", {
                    mod: formatMod(mod),
                    dmgSuffix: w.damage ? tr("play.weaponDmgSuffix", { dmg: w.damage }) : "",
                  })}
                  onClick={() => attack(w)}
                />
              );
            })}
          </div>
        </div>
      )}

      {spells.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("play.spellsActions")}</p>
          <div className="grid grid-cols-1 gap-2">
            {spells.map((s, i) => (
              <ActionTile
                key={i}
                label={tr("play.castSpellTile", { name: localizeGamePhrase(s.name, locale) })}
                subtitle={
                  s.level === 0
                    ? tr("play.spellCantrip")
                    : `${tr("play.spellLevel", { n: s.level })}${s.prepared ? tr("play.spellPrepared") : ""}`
                }
                onClick={() => castSpell(s)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <p className="label mb-2">
          {skills.length ? tr("play.skillsHeadingProf") : tr("play.skillsHeadingNone")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(skills.length > 0 ? skills : Object.keys(SKILL_ABILITY).slice(0, 6)).map((s) => {
            const ab = SKILL_ABILITY[s.toLowerCase()] ?? "sab";
            const mod = abilityMod(totalAbility(abilities, racial, ab)) + (skills.includes(s) ? prof : 0);
            return (
              <ActionTile
                key={s}
                label={localizedSkillLabel(s.toLowerCase(), locale)}
                subtitle={`${localizedAbilityAbbrev(ab, locale)} ${formatMod(mod)}`}
                onClick={() => rollSkill(s)}
              />
            );
          })}
        </div>
      </div>

      <div className="card">
        <p className="label mb-2">{tr("play.saves")}</p>
        <div className="grid grid-cols-3 gap-2">
          {ABILITIES_ORDER.map((a) => {
            const base = abilityMod(totalAbility(abilities, racial, a));
            const hasProf = (data.savingThrows ?? []).includes(a);
            const mod = base + (hasProf ? prof : 0);
            return (
              <ActionTile
                key={a}
                label={localizedAbilityAbbrev(a, locale)}
                subtitle={`${formatMod(mod)}${hasProf ? " ✓" : ""}`}
                onClick={() => rollSave(a)}
              />
            );
          })}
        </div>
      </div>

      {consumables.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("play.consumables")}</p>
          <div className="grid grid-cols-2 gap-2">
            {consumables.map((c, i) => (
              <ActionTile
                key={i}
                label={localizeGamePhrase(c.name, locale)}
                subtitle={c.qty > 1 ? `×${c.qty}` : tr("play.useConsumable")}
                onClick={() => useItem(c.name)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-[11px]" style={{ color: "var(--color-text-hint)" }}>
        {tr("play.footerProf", { level, prof })}
      </p>
    </div>
  );
}

function DicePanel({
  pending,
  selected,
  selectedLabel,
  modifier,
  recent,
  data,
  prof,
  onSelect,
  onModifier,
  onRoll,
  onReportManual,
  onDismiss,
}: {
  pending: DiceRequest[];
  selected: string;
  selectedLabel: string;
  modifier: number;
  recent: DiceResult[];
  data: CharData;
  prof: number;
  onSelect: (expr: string, label?: string) => void;
  onModifier: (m: number) => void;
  onRoll: () => void;
  onReportManual: (r: DiceRequest, total: number) => void;
  onDismiss: (id: string) => void;
}) {
  const tr = useTranslations();
  const abilities = data.abilities ?? { fue: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 };
  const racial = data.abilityRacialBonus ?? {};
  const savingThrows = data.savingThrows ?? [];

  const dice = ["1d4", "1d6", "1d8", "1d10", "1d12", "1d20", "1d100", "2d6"];
  const modifierChips = [
    { label: "+0", v: 0 },
    { label: "+PB", v: prof },
    ...ABILITIES_ORDER.map((a) => ({
      label: `+${a.toUpperCase()}`,
      v: abilityMod(totalAbility(abilities, racial, a)),
    })),
    ...ABILITIES_ORDER.filter((a) => savingThrows.includes(a)).map((a) => ({
      label: `+${a.toUpperCase()}+PB`,
      v: abilityMod(totalAbility(abilities, racial, a)) + prof,
    })),
  ];

  const [manualById, setManualById] = useState<Record<string, string>>({});

  const queueVirtualLine = useMemo(() => {
    const head = pending[0];
    if (!head) return null;
    const ok = canResolveDmDiceExpression(head.expression, prof, data);
    const resolved = ok ? resolveDmDiceExpression(head.expression, prof, data) : head.expression;
    return {
      index: 1,
      total: pending.length,
      resolved,
      label: head.label,
      dc: head.dc,
      resolvable: ok,
    };
  }, [pending, prof, data]);

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="card" style={{ border: "1px solid var(--color-accent)" }}>
          <p className="label mb-2" style={{ color: "var(--color-accent)" }}>
            {tr("play.diceDmRequests", { n: pending.length })}
          </p>
          <p className="mb-2 text-[11px]" style={{ color: "var(--color-text-secondary)" }}>
            {tr("play.dicePhysicalHint")}
          </p>
          <div className="space-y-2">
            {pending.map((r) => (
              <div
                key={r.id}
                className="rounded-md p-2"
                style={{ background: "var(--color-bg-tertiary)" }}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.label ?? r.expression}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {r.expression}
                      {r.dc ? ` · ${tr("play.dc")} ${r.dc}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    style={{ padding: "6px 10px", fontSize: 12 }}
                    onClick={() => onDismiss(r.id)}
                    title={tr("play.dismissRequest")}
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    className="input flex-1"
                    style={{ height: 36, fontSize: 13 }}
                    placeholder={tr("play.totalPlaceholder")}
                    value={manualById[r.id] ?? ""}
                    onChange={(e) => setManualById((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const raw = (manualById[r.id] ?? "").trim().replace(",", ".");
                        const n = parseInt(raw, 10);
                        if (!Number.isFinite(n)) return;
                        onReportManual(r, n);
                        setManualById((prev) => {
                          const next = { ...prev };
                          delete next[r.id];
                          return next;
                        });
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost shrink-0"
                    style={{ padding: "6px 10px", fontSize: 12 }}
                    onClick={() => {
                      const raw = (manualById[r.id] ?? "").trim().replace(",", ".");
                      const n = parseInt(raw, 10);
                      if (!Number.isFinite(n)) return;
                      onReportManual(r, n);
                      setManualById((prev) => {
                        const next = { ...prev };
                        delete next[r.id];
                        return next;
                      });
                    }}
                  >
                    {tr("play.register")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <p className="label mb-2">{tr("play.dieSingular")}</p>
        <div className="grid grid-cols-4 gap-2">
          {dice.map((d) => (
            <button
              key={d}
              onClick={() => onSelect(d, "")}
              className="rounded-md py-2 text-center text-sm"
              style={{
                background: selected === d ? "var(--color-accent-bg)" : "var(--color-bg-tertiary)",
                border: `0.5px solid ${selected === d ? "var(--color-accent)" : "var(--color-border)"}`,
                color: selected === d ? "var(--color-accent)" : "var(--color-text-primary)",
              }}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="card">
        <p className="label mb-2">{tr("play.modifier")}</p>
        <div className="flex flex-wrap gap-1">
          {modifierChips.map((c) => (
            <button
              key={c.label}
              onClick={() => onModifier(c.v)}
              className="rounded-md px-2 py-1 text-xs"
              style={{
                background: modifier === c.v ? "var(--color-accent-bg)" : "var(--color-bg-tertiary)",
                border: `0.5px solid ${modifier === c.v ? "var(--color-accent)" : "var(--color-border)"}`,
                color: modifier === c.v ? "var(--color-accent)" : "var(--color-text-secondary)",
              }}
            >
              {c.label} ({formatMod(c.v)})
            </button>
          ))}
        </div>
      </div>

      <button
        className="btn-accent w-full"
        style={{ padding: "12px", fontSize: 14 }}
        onClick={onRoll}
        disabled={Boolean(queueVirtualLine && !queueVirtualLine.resolvable)}
      >
        {queueVirtualLine ? (
          <>
            <span className="block text-[11px] font-medium opacity-90">
              {tr("play.rollVirtualLine", {
                i: queueVirtualLine.index,
                total: queueVirtualLine.total,
                dcSuffix:
                  typeof queueVirtualLine.dc === "number"
                    ? tr("play.rollVirtualDcSuffix", { dc: queueVirtualLine.dc })
                    : "",
              })}
            </span>
            <span className="mt-0.5 block">
              {tr("play.rollVirtualButton", {
                expr: queueVirtualLine.resolved,
                labelSuffix: queueVirtualLine.label
                  ? tr("play.rollVirtualLabelSuffix", { label: queueVirtualLine.label })
                  : "",
              })}
            </span>
            {!queueVirtualLine.resolvable ? (
              <span className="mt-1 block text-[11px] opacity-90">{tr("play.rollUseRegister")}</span>
            ) : null}
          </>
        ) : (
          <>
            {tr("play.rollDiceButton", {
              dice: `${selected}${modifier !== 0 ? formatMod(modifier) : ""}`,
              labelSuffix: selectedLabel ? ` · ${selectedLabel}` : "",
            })}
          </>
        )}
      </button>

      {recent.length > 0 && (
        <div className="card">
          <p className="label mb-2">{tr("play.recentRolls")}</p>
          <ul className="space-y-1 text-sm">
            {recent.map((r, i) => (
              <li key={i} className="flex items-baseline gap-2">
                <span className="badge" style={{ fontSize: 10 }}>
                  {r.expression}
                </span>
                <span style={{ color: "var(--color-text-secondary)" }}>{r.breakdown}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActionTile({ label, subtitle, onClick }: { label: string; subtitle: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card text-left" style={{ padding: "10px 12px" }}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-0.5 text-[11px]" style={{ color: "var(--color-text-hint)" }}>
        {subtitle}
      </p>
    </button>
  );
}
