"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { parseDmResponse } from "./parse";
import { MapCanvas, BattleMapCanvas, type BattleMap } from "./map";
import { QrPanel } from "./qr";

type Difficulty = "facil" | "medio" | "dificil" | "experto";
const DIFFICULTY_VALUES: Difficulty[] = ["facil", "medio", "dificil", "experto"];
const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
  experto: "Experto",
};
const DIFFICULTY_SUB: Record<Difficulty, string> = {
  facil: "Tarde relajada · CDs bajas, enemigos indulgentes",
  medio: "Balanceado · CDs estándar 5E",
  dificil: "Exigente · tácticas óptimas, recursos escasos",
  experto: "Brutal · muerte permanente posible",
};
const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  facil: "hsl(150, 55%, 55%)",
  medio: "hsl(210, 60%, 55%)",
  dificil: "hsl(30, 80%, 55%)",
  experto: "hsl(0, 70%, 55%)",
};

function normalizeDifficulty(raw: unknown): Difficulty {
  if (raw === "facil" || raw === "medio" || raw === "dificil" || raw === "experto") return raw;
  return "medio";
}

type Player = {
  playerId: string;
  token: string;
  connected: boolean;
  character: { id: string; name: string; level: number; class: string | null; race: string | null; data: Record<string, unknown> } | null;
};

type Message = { id: number; role: string; player_id: string | null; kind: string; content: string; created_at: number };

type Story = { id: string; title: string; mode: "auto" | "assistant"; summary: string | null };

type ChatBubble = {
  role: "player" | "dm" | "system";
  text: string;
  id: string;
  playerName?: string;
  kind?: "public" | "private";
};

type AdventureIngest = {
  status: "pending" | "running" | "done" | "error";
  phase?: "extracting" | "embedding" | "summarizing" | "done" | "error";
  done?: number;
  total?: number;
  error?: string;
  fileName?: string;
};

type InitialState = {
  sceneTags?: string[];
  sceneImage?: string;
  coverImage?: string;
  tone?: number;
  difficulty?: Difficulty | string;
  openingDone?: boolean;
  autoSpeak?: boolean;
  combat?: boolean;
  battleMap?: BattleMap | null;
  adventureIngest?: AdventureIngest;
};

function randomId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function toneLabel(value: number): string {
  if (value <= 15) return "Estricto · puro manual";
  if (value <= 35) return "Serio · cinematográfico";
  if (value <= 55) return "Equilibrado · clásico";
  if (value <= 75) return "Ocurrente · con chispa";
  return "Bufonesco · cartoon";
}

function toneGradient(value: number): string {
  const hue = 220 - (value / 100) * 200;
  return `hsl(${hue}, 70%, 55%)`;
}

export function StoryRoom({
  sessionId,
  story,
  players: initialPlayers,
  initialMessages,
  initialState,
}: {
  sessionId: string;
  story: Story;
  players: Player[];
  initialMessages: Message[];
  initialState: InitialState;
}) {
  const clientIdRef = useRef<string>(randomId());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [chat, setChat] = useState<ChatBubble[]>(() =>
    initialMessages.map((m) => ({
      id: String(m.id),
      role: m.role as ChatBubble["role"],
      text: m.content,
      kind: m.kind === "private" ? "private" : "public",
    }))
  );
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sceneHint, setSceneHint] = useState<string>(initialState.sceneTags?.[0] ?? "ninguno");
  const [showQr, setShowQr] = useState(false);
  const [sceneImage, setSceneImage] = useState<string | null>(initialState.sceneImage ?? null);
  const [coverImage, setCoverImage] = useState<string | null>(initialState.coverImage ?? null);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [generatingCover, setGeneratingCover] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [combat, setCombat] = useState<boolean>(initialState.combat === true);
  const [battleMap, setBattleMap] = useState<BattleMap | null>(initialState.battleMap ?? null);
  const [turnCounter, setTurnCounter] = useState(0);
  const [tone, setTone] = useState<number>(() =>
    typeof initialState.tone === "number" ? Math.max(0, Math.min(100, initialState.tone)) : 50
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(() => normalizeDifficulty(initialState.difficulty));
  const [openingDone, setOpeningDone] = useState<boolean>(initialState.openingDone === true);
  const [ingest, setIngest] = useState<AdventureIngest | null>(initialState.adventureIngest ?? null);
  const [whisperTo, setWhisperTo] = useState<string>("all");
  const [autoSpeak, setAutoSpeak] = useState<boolean>(initialState.autoSpeak === true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [player, setPlayer] = useState<{
    id: string;
    url: string;
    playing: boolean;
    duration: number;
    current: number;
  } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playerMap = useMemo(() => Object.fromEntries(players.map((p) => [p.playerId, p])), [players]);
  const chatEnd = useRef<HTMLDivElement>(null);
  const openingAttempted = useRef(false);
  const speakQueueRef = useRef<string | null>(null);

  const speakText = useCallback(async (id: string, text: string) => {
    if (!text.trim()) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, emotion: "epica" }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onloadedmetadata = () =>
          setPlayer((p) => (p && p.id === id ? { ...p, duration: audio.duration || 0 } : p));
        audio.ontimeupdate = () =>
          setPlayer((p) => (p && p.id === id ? { ...p, current: audio.currentTime } : p));
        audio.onplay = () => setPlayer((p) => (p && p.id === id ? { ...p, playing: true } : p));
        audio.onpause = () => setPlayer((p) => (p && p.id === id ? { ...p, playing: false } : p));
        audio.onended = () => setPlayer((p) => (p && p.id === id ? { ...p, playing: false, current: 0 } : p));
        setPlayer({ id, url, playing: true, duration: 0, current: 0 });
        await audio.play();
        return;
      }
    } catch {}
    window.speechSynthesis?.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    utter.rate = 0.95;
    utter.pitch = 0.95;
    setPlayer({ id, url: "", playing: true, duration: 0, current: 0 });
    utter.onend = () => setPlayer(null);
    window.speechSynthesis?.speak(utter);
  }, []);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  }, []);

  const stopPlay = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
    }
    window.speechSynthesis?.cancel();
    setPlayer(null);
  }, []);

  const seekTo = useCallback((t: number) => {
    const a = audioRef.current;
    if (a) a.currentTime = t;
  }, []);

  useEffect(() => {
    const s = io({ path: "/socket.io", query: { clientId: clientIdRef.current } });
    s.on("connect", () => {
      s.emit("session:join", { sessionId, role: "dm" }, () => {});
    });
    s.on(
      "chat:message",
      (msg: { role: string; text: string; playerId?: string; kind?: string; originClientId?: string; id?: string }) => {
        if (msg.kind === "dm-assistant") return;
        if (msg.role === "dm" && msg.originClientId === clientIdRef.current) return;
        setChat((prev) => [
          ...prev,
          {
            id: msg.id ?? randomId(),
            role: msg.role as ChatBubble["role"],
            text: msg.text,
            playerName: msg.playerId ? playerMap[msg.playerId]?.character?.name : undefined,
            kind: (msg.kind as "public" | "private") ?? "public",
          },
        ]);
        if (msg.role === "dm" && autoSpeak && msg.text) {
          const id = msg.id ?? randomId();
          speakQueueRef.current = null;
          void speakText(id, msg.text);
        }
      }
    );
    s.on(
      "dice:result",
      (evt: {
        by: { role: string; playerId?: string; label?: string };
        result: { breakdown: string; expression: string; total: number };
      }) => {
        const who = evt.by.playerId ? playerMap[evt.by.playerId]?.character?.name ?? "Jugador" : "DM";
        setChat((prev) => [
          ...prev,
          {
            id: randomId(),
            role: "system",
            text: `🎲 ${who} tira ${evt.result.expression} ${evt.by.label ? "(" + evt.by.label + ")" : ""}: ${evt.result.breakdown}`,
          },
        ]);
      }
    );
    s.on(
      "dice:request",
      (evt: {
        sessionId: string;
        targets: string[];
        requests: Array<{ id?: string; playerId?: string; expression: string; label?: string; dc?: number }>;
      }) => {
        if (evt.sessionId !== sessionId) return;
        for (const req of evt.requests) {
          const who = req.playerId ? playerMap[req.playerId]?.character?.name ?? "un jugador" : "el grupo";
          setChat((prev) => [
            ...prev,
            {
              id: randomId(),
              role: "system",
              text: `🎯 El DM pide a ${who} tirar ${req.expression}${req.label ? ` (${req.label})` : ""}${
                req.dc ? ` — CD ${req.dc}` : ""
              }.`,
            },
          ]);
        }
      }
    );
    s.on("character:update", (evt: { playerId: string; patch: Record<string, unknown> }) => {
      setPlayers((prev) =>
        prev.map((p) =>
          p.playerId === evt.playerId && p.character
            ? { ...p, character: { ...p.character, data: { ...p.character.data, ...evt.patch } } }
            : p
        )
      );
    });
    s.on(
      "scene:update",
      (evt: { sessionId: string; combat?: boolean; battleMap?: BattleMap | null; sceneTags?: string[] }) => {
        if (evt.sessionId !== sessionId) return;
        if (typeof evt.combat === "boolean") setCombat(evt.combat);
        if (evt.battleMap !== undefined) setBattleMap(evt.battleMap);
        if (Array.isArray(evt.sceneTags) && evt.sceneTags[0]) setSceneHint(evt.sceneTags[0]);
        setTurnCounter((t) => t + 1);
      }
    );
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [sessionId, playerMap, autoSpeak, speakText]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const runDm = useCallback(
    async (payload: {
      action: "opening" | "continue" | "player";
      text?: string;
      playerId?: string;
      playerName?: string;
      showPlayer?: boolean;
    }) => {
      if (streaming) return;
      setStreaming(true);

      if (payload.showPlayer && payload.text) {
        setChat((prev) => [
          ...prev,
          {
            id: randomId(),
            role: "player",
            text: payload.text ?? "",
            playerName: payload.playerName,
          },
        ]);
      }
      if (payload.action === "continue") {
        setChat((prev) => [
          ...prev,
          { id: randomId(), role: "system", text: "— el DM retoma el hilo —" },
        ]);
      }

      const dmId = randomId();
      setChat((prev) => [...prev, { id: dmId, role: "dm", text: "" }]);
      if (autoSpeak) speakQueueRef.current = dmId;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            mode: story.mode,
            action: payload.action,
            playerId: payload.playerId,
            playerName: payload.playerName,
            text: payload.text ?? "",
            tone,
            difficulty,
            clientId: clientIdRef.current,
          }),
        });
        if (!res.body) throw new Error("sin stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const piece = decoder.decode(value, { stream: true });
          buffer += piece;
          setChat((prev) => prev.map((m) => (m.id === dmId ? { ...m, text: buffer } : m)));
        }
        const parsed = parseDmResponse(buffer);
        const actObj = parsed.actions as Record<string, unknown>;
        if (actObj?.map && typeof actObj.map === "object") {
          const hint = (actObj.map as { hint?: string }).hint;
          if (hint) setSceneHint(hint);
        }
        let nextCombat = combat;
        if (typeof actObj?.combat === "boolean") nextCombat = actObj.combat as boolean;
        if (actObj?.combat_end === true) nextCombat = false;
        if (nextCombat !== combat) setCombat(nextCombat);

        if (actObj?.battle_map && typeof actObj.battle_map === "object" && !Array.isArray(actObj.battle_map)) {
          try {
            const bm = actObj.battle_map as BattleMap;
            setBattleMap(bm);
          } catch {}
        }
        if (!nextCombat) setBattleMap(null);
        setTurnCounter((t) => t + 1);

        const clean = parsed.narrative.replace(/\[emocion:[^\]]+\]/gi, "").trim();
        setChat((prev) => prev.map((m) => (m.id === dmId ? { ...m, text: clean } : m)));
        if (payload.action === "opening") setOpeningDone(true);

        if (speakQueueRef.current === dmId && clean) {
          speakQueueRef.current = null;
          void speakText(dmId, clean);
        }
      } catch (err) {
        setChat((prev) =>
          prev.map((m) => (m.id === dmId ? { ...m, text: `Error: ${(err as Error).message}` } : m))
        );
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, story.mode, streaming, tone, difficulty, autoSpeak, speakText, combat]
  );

  const ingestActive = !!ingest && ingest.status !== "done" && ingest.status !== "error";

  useEffect(() => {
    if (!ingestActive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/session/${sessionId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { state?: { adventureIngest?: AdventureIngest } };
        if (cancelled) return;
        if (data.state?.adventureIngest) setIngest(data.state.adventureIngest);
      } catch {}
    };
    const id = setInterval(tick, 2000);
    void tick();
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ingestActive, sessionId]);

  useEffect(() => {
    if (openingAttempted.current) return;
    if (story.mode !== "auto") return;
    if (openingDone) return;
    if (ingestActive) return;
    const hasDmMsg = chat.some((m) => m.role === "dm" && m.text.trim().length > 0);
    if (hasDmMsg) return;
    openingAttempted.current = true;
    void runDm({ action: "opening" });
  }, [chat, openingDone, runDm, story.mode, ingestActive]);

  async function send() {
    if (!input.trim() || streaming) return;
    const text = input.trim();
    setInput("");

    if (whisperTo !== "all" && socket) {
      const target = players.find((p) => p.playerId === whisperTo);
      socket.emit("chat:send", {
        sessionId,
        role: "dm",
        playerId: whisperTo,
        kind: "private",
        text,
      });
      setChat((prev) => [
        ...prev,
        {
          id: randomId(),
          role: "dm",
          text,
          kind: "private",
          playerName: target?.character?.name,
        },
      ]);
      return;
    }

    const playerPid = players[0]?.playerId;
    const playerName = players[0]?.character?.name ?? "Jugador";
    await runDm({ action: "player", text, playerId: playerPid, playerName, showPlayer: true });
  }

  async function continueStory() {
    if (streaming) return;
    await runDm({ action: "continue" });
  }

  async function persistState(patch: Record<string, unknown>) {
    try {
      await fetch(`/api/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: patch }),
      });
    } catch {}
  }

  async function persistTone(next: number) {
    setTone(next);
    await persistState({ tone: next });
  }

  async function persistDifficulty(next: Difficulty) {
    setDifficulty(next);
    await persistState({ difficulty: next });
  }

  async function toggleAutoSpeak() {
    const next = !autoSpeak;
    setAutoSpeak(next);
    await persistState({ autoSpeak: next });
  }

  async function generateScene() {
    setGeneratingImage(true);
    setImageError(null);
    try {
      const lastDm = [...chat].reverse().find((m) => m.role === "dm")?.text ?? "";
      const prompt = [
        `Ilustración cinematográfica para una escena de Dungeons & Dragons titulada "${story.title}".`,
        `Ambiente: ${sceneHint}.`,
        lastDm ? `Narrativa reciente: ${lastDm.slice(0, 500)}` : "",
        "Estilo pintura digital, iluminación atmosférica, composición amplia, sin texto ni logos.",
      ]
        .filter(Boolean)
        .join(" ");
      const hintKey = (sceneHint || "ninguno").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 48);
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          title: story.title,
          tags: ["historia", story.id, sceneHint, "escena"],
          size: "1536x1024",
          cacheKey: `story:${story.id}:scene:${hintKey}`,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "falló la generación");
      setSceneImage(data.url);
      void persistState({ sceneImage: data.url });
    } catch (err) {
      setImageError((err as Error).message);
    } finally {
      setGeneratingImage(false);
    }
  }

  const generateCover = useCallback(async () => {
    if (generatingCover || coverImage) return;
    setGeneratingCover(true);
    try {
      const prompt = [
        `Portada cinematográfica para una campaña de Dungeons & Dragons titulada "${story.title}".`,
        story.summary ? `Premisa: ${story.summary.slice(0, 400)}.` : "",
        `Ambiente sugerido: ${sceneHint === "ninguno" ? "fantasía heroica" : sceneHint}.`,
        "Composición panorámica tipo póster, pintura digital, atmósfera épica, sin texto ni logos, protagonistas pequeños en un paisaje majestuoso.",
      ]
        .filter(Boolean)
        .join(" ");
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          title: `${story.title} · portada`,
          tags: ["historia", story.id, "portada"],
          size: "1536x1024",
          cacheKey: `story:${story.id}:cover`,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) return;
      setCoverImage(data.url);
      void persistState({ coverImage: data.url });
    } catch {
    } finally {
      setGeneratingCover(false);
    }
  }, [coverImage, generatingCover, sceneHint, story.id, story.summary, story.title]);

  useEffect(() => {
    if (coverImage) return;
    if (!openingDone) return;
    void generateCover();
  }, [coverImage, openingDone, generateCover]);

  function clearScene() {
    setSceneImage(null);
    void persistState({ sceneImage: null });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]" style={{ minHeight: "calc(100vh - 160px)" }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="label">Historia</p>
            <h1 style={{ fontSize: 30 }}>{story.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{story.mode === "auto" ? "DM automático" : "DM asistente"}</span>
            {combat && (
              <span
                className="badge"
                style={{ background: "rgba(216,90,48,0.18)", color: "#f4a582", borderColor: "rgba(216,90,48,0.35)" }}
              >
                ⚔ En combate
              </span>
            )}
            <button
              onClick={generateScene}
              className="btn-ghost"
              disabled={generatingImage || combat}
              title={combat ? "El mapa táctico está activo durante el combate" : "Pinta una ilustración de la escena actual"}
            >
              {generatingImage ? "Pintando…" : sceneImage ? "Nueva escena" : "Generar escena"}
            </button>
            {sceneImage && !combat && (
              <button onClick={clearScene} className="btn-ghost" title="Volver a la portada por defecto">
                Portada
              </button>
            )}
            <button onClick={() => setShowQr((v) => !v)} className="btn-ghost">
              {showQr ? "Ocultar QR" : "Invitar por QR"}
            </button>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={settingsOpen ? "btn-accent" : "btn-ghost"}
              aria-expanded={settingsOpen}
            >
              ⚙ Ajustes del DM
            </button>
          </div>
        </div>

        {ingest && <AdventureIngestBanner ingest={ingest} />}

        {showQr && <QrPanel sessionId={sessionId} players={players} />}

        {settingsOpen && (
          <DmSettingsDrawer
            tone={tone}
            onTone={persistTone}
            difficulty={difficulty}
            onDifficulty={persistDifficulty}
            streaming={streaming}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={toggleAutoSpeak}
          />
        )}

        <div
          className="relative overflow-hidden rounded-lg"
          style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-secondary)", minHeight: 420 }}
        >
          {combat && battleMap ? (
            <BattleMapCanvas battleMap={battleMap} turn={turnCounter} />
          ) : combat ? (
            <div className="relative h-full w-full" style={{ minHeight: 420 }}>
              <MapCanvas hint={sceneHint} players={players} />
              <div
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{ background: "rgba(15,14,12,0.35)" }}
              >
                <p
                  className="text-sm"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "#f4a582",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  ⚔ esperando posiciones del DM…
                </p>
              </div>
            </div>
          ) : sceneImage ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sceneImage} alt="Escena" className="h-full w-full object-cover" style={{ minHeight: 420 }} />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(15,14,12,0.55), transparent 45%)" }}
              />
              <div className="absolute left-3 top-3">
                <span
                  className="badge"
                  style={{ background: "rgba(15,14,12,0.55)", color: "#faf7f1", borderColor: "rgba(255,255,255,0.15)" }}
                >
                  Escena actual
                </span>
              </div>
            </div>
          ) : coverImage ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage} alt="Portada" className="h-full w-full object-cover" style={{ minHeight: 420 }} />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(15,14,12,0.65), transparent 55%)" }}
              />
              <div className="absolute bottom-4 left-5 right-5">
                <p
                  className="label"
                  style={{ color: "rgba(244,239,230,0.7)", letterSpacing: "0.14em" }}
                >
                  Portada
                </p>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    color: "#faf7f1",
                    fontSize: 26,
                    lineHeight: 1.15,
                    textShadow: "0 2px 12px rgba(0,0,0,0.55)",
                  }}
                >
                  {story.title}
                </h2>
              </div>
            </div>
          ) : (
            <div className="relative h-full w-full" style={{ minHeight: 420 }}>
              <MapCanvas hint={sceneHint} players={players} />
              {generatingCover && (
                <div
                  className="pointer-events-none absolute left-3 top-3 rounded-md px-2 py-1 text-xs"
                  style={{ background: "rgba(15,14,12,0.6)", color: "rgba(244,239,230,0.75)" }}
                >
                  pintando portada…
                </div>
              )}
            </div>
          )}
          {imageError && (
            <div
              className="absolute bottom-3 left-3 right-3 rounded-md px-3 py-2 text-xs"
              style={{ background: "rgba(216, 90, 48, 0.2)", color: "#f4a582" }}
            >
              {imageError} — configura un proveedor en /settings o usa OpenAI/Gemini/Stability con API key.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {players.map((p) => {
            const rawHp = (p.character?.data?.hp as { current?: number; max?: number; temp?: number } | undefined) ?? {};
            const hp = { current: rawHp.current ?? 0, max: rawHp.max ?? 0, temp: rawHp.temp ?? 0 };
            const statuses = (p.character?.data?.statusEffects as string[] | undefined) ?? [];
            return (
              <div key={p.playerId} className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.character?.name ?? "—"}</p>
                    <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
                      {p.character?.race ?? "?"} · {p.character?.class ?? "?"} · nv. {p.character?.level ?? 1}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: p.connected ? "var(--color-accent)" : "var(--color-text-hint)" }}>
                    {p.connected ? "● online" : "○ offline"}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--color-text-hint)" }}>HP</span>
                    <span>
                      {hp.current}/{hp.max}
                      {hp.temp ? ` (+${hp.temp})` : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--color-bg-tertiary)" }}>
                    <div
                      style={{
                        width: `${Math.min(100, (hp.current / Math.max(1, hp.max)) * 100)}%`,
                        height: "100%",
                        background: "var(--color-accent)",
                      }}
                    />
                  </div>
                </div>
                {statuses.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {statuses.map((s) => (
                      <span key={s} className="badge" style={{ fontSize: 10 }}>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <aside
        className="relative flex flex-col rounded-lg"
        style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-secondary)", maxHeight: "calc(100vh - 160px)" }}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "0.5px solid var(--color-border)" }}>
          <p className="label">Crónica</p>
          <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
            {chat.length} mensajes
          </span>
        </div>

        {player && <AudioPlayer player={player} onToggle={togglePlay} onStop={stopPlay} onSeek={seekTo} />}

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {chat.map((m) => (
            <div key={m.id}>
              {m.role === "dm" ? (
                <DmBubble
                  id={m.id}
                  text={m.text}
                  isPrivate={m.kind === "private"}
                  target={m.playerName}
                  onSpeak={() => speakText(m.id, m.text)}
                  active={player?.id === m.id}
                  playing={player?.id === m.id && (player?.playing ?? false)}
                />
              ) : m.role === "system" ? (
                <p className="text-xs italic" style={{ color: "var(--color-text-hint)" }}>
                  {m.text}
                </p>
              ) : (
                <PlayerBubble name={m.playerName ?? "Jugador"} text={m.text} />
              )}
            </div>
          ))}
          {streaming && (
            <p className="text-xs italic" style={{ color: "var(--color-text-hint)" }}>
              el DM está escribiendo…
            </p>
          )}
          <div ref={chatEnd} />
        </div>

        <div className="space-y-2 p-4" style={{ borderTop: "0.5px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <label className="label" style={{ fontSize: 10 }}>
              Dirigir a
            </label>
            <select
              value={whisperTo}
              onChange={(e) => setWhisperTo(e.target.value)}
              className="input"
              style={{ height: 30, fontSize: 12, flex: 1 }}
            >
              <option value="all">🎭 Todo el grupo (DM narra)</option>
              {players.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  🔒 Susurro a {p.character?.name ?? p.playerId}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={
                whisperTo !== "all"
                  ? `Mensaje privado a ${playerMap[whisperTo]?.character?.name ?? ""}…`
                  : story.mode === "auto"
                    ? "¿Qué hace tu personaje?"
                    : "Instrucción para la IA asistente…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button onClick={send} className="btn-accent" disabled={streaming || !input.trim()}>
              {streaming ? "…" : whisperTo !== "all" ? "Susurrar" : "Enviar"}
            </button>
          </div>
          {story.mode === "auto" && whisperTo === "all" && (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={continueStory}
                className="btn-ghost"
                style={{ flex: 1 }}
                disabled={streaming}
                title="El DM retoma la narrativa con lo que han dicho los jugadores"
              >
                ▶ Continuar historia
              </button>
              {!openingDone && (
                <button
                  onClick={() => runDm({ action: "opening" })}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                  disabled={streaming}
                >
                  ✦ Abrir aventura
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function DmSettingsDrawer({
  tone,
  onTone,
  difficulty,
  onDifficulty,
  streaming,
  autoSpeak,
  onToggleAutoSpeak,
}: {
  tone: number;
  onTone: (v: number) => void;
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  streaming: boolean;
  autoSpeak: boolean;
  onToggleAutoSpeak: () => void;
}) {
  return (
    <div
      className="rounded-lg"
      style={{
        border: "0.5px solid var(--color-border)",
        background: "var(--color-bg-secondary)",
        animation: "fadeUp 0.3s ease both",
      }}
    >
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
        <ToneDial value={tone} onChange={onTone} disabled={streaming} />
        <DifficultyDial value={difficulty} onChange={onDifficulty} disabled={streaming} />
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3 md:col-span-2"
          style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
        >
          <div>
            <p className="label">Audio automático</p>
            <p className="text-xs" style={{ color: "var(--color-text-hint)", maxWidth: 280 }}>
              {autoSpeak
                ? "El DM narrará en voz alta cada nueva narrativa."
                : "Usa el botón 🔊 de cada mensaje para escucharlo."}
            </p>
          </div>
          <button
            onClick={onToggleAutoSpeak}
            aria-pressed={autoSpeak}
            className="rounded-full"
            style={{
              width: 44,
              height: 24,
              padding: 2,
              background: autoSpeak ? "var(--color-accent)" : "var(--color-bg-primary)",
              border: "0.5px solid var(--color-border)",
              transition: "background 0.15s ease",
              cursor: "pointer",
            }}
          >
            <span
              style={{
                display: "block",
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: autoSpeak ? "white" : "var(--color-text-hint)",
                transform: autoSpeak ? "translateX(20px)" : "translateX(0)",
                transition: "transform 0.15s ease",
              }}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

function DifficultyDial({
  value,
  onChange,
  disabled,
}: {
  value: Difficulty;
  onChange: (v: Difficulty) => void;
  disabled?: boolean;
}) {
  const idx = Math.max(0, DIFFICULTY_VALUES.indexOf(value));
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Dificultad</p>
          <p className="text-sm" style={{ color: DIFFICULTY_COLOR[value] }}>
            {DIFFICULTY_LABELS[value]}
          </p>
        </div>
        <span className="text-[10px]" style={{ color: "var(--color-text-hint)" }}>
          {idx + 1}/{DIFFICULTY_VALUES.length}
        </span>
      </div>
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={DIFFICULTY_VALUES.length - 1}
          step={1}
          value={idx}
          disabled={disabled}
          onChange={(e) => {
            const next = DIFFICULTY_VALUES[Number(e.target.value)] ?? "medio";
            onChange(next);
          }}
          style={{
            width: "100%",
            accentColor: DIFFICULTY_COLOR[value],
            height: 4,
            borderRadius: 999,
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--color-text-hint)" }}>
          {DIFFICULTY_VALUES.map((d) => (
            <span key={d} style={{ color: d === value ? DIFFICULTY_COLOR[d] : undefined }}>
              {DIFFICULTY_LABELS[d].toLowerCase()}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
          {DIFFICULTY_SUB[value]}
        </p>
      </div>
    </div>
  );
}

function AudioPlayer({
  player,
  onToggle,
  onStop,
  onSeek,
}: {
  player: { id: string; playing: boolean; duration: number; current: number };
  onToggle: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
}) {
  const pct = player.duration > 0 ? (player.current / player.duration) * 100 : 0;
  return (
    <div
      className="flex items-center gap-3 px-5 py-2"
      style={{ borderBottom: "0.5px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
    >
      <button onClick={onToggle} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 14 }}>
        {player.playing ? "⏸" : "▶"}
      </button>
      <button onClick={onStop} className="btn-ghost" style={{ padding: "4px 10px", fontSize: 14 }}>
        ⏹
      </button>
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={Math.max(0.01, player.duration || 0)}
          step={0.1}
          value={player.current}
          disabled={!player.duration}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{ width: "100%", accentColor: "var(--color-accent)" }}
        />
        <div className="flex justify-between text-[10px]" style={{ color: "var(--color-text-hint)" }}>
          <span>{formatTime(player.current)}</span>
          <span>{player.duration ? formatTime(player.duration) : "live"}</span>
        </div>
      </div>
      <span className="text-[10px]" style={{ color: "var(--color-text-hint)" }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function formatTime(s: number): string {
  if (!Number.isFinite(s) || s <= 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function ToneDial({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="label">Tono del DM</p>
          <p className="text-sm" style={{ color: toneGradient(value) }}>
            {toneLabel(value)}
          </p>
        </div>
        <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
          {value}/100
        </span>
      </div>
      <div className="mt-3">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            width: "100%",
            accentColor: toneGradient(value),
            height: 4,
            borderRadius: 999,
            appearance: "none",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        />
        <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--color-text-hint)" }}>
          <span>serio · manual</span>
          <span>equilibrado</span>
          <span>ocurrente · cartoon</span>
        </div>
      </div>
    </div>
  );
}

function DmBubble({
  text,
  onSpeak,
  active,
  playing,
  isPrivate,
  target,
}: {
  id: string;
  text: string;
  onSpeak: () => void;
  active: boolean;
  playing: boolean;
  isPrivate?: boolean;
  target?: string;
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: isPrivate ? "var(--color-accent-bg)" : "var(--color-bg-tertiary)",
        border: `0.5px solid ${isPrivate ? "var(--color-accent)" : "var(--color-border)"}`,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="label" style={{ color: "var(--color-accent)" }}>
          {isPrivate ? `🔒 Susurro${target ? " → " + target : ""}` : "Dungeon Master"}
        </span>
        <button
          onClick={onSpeak}
          className="text-xs"
          style={{ color: active ? "var(--color-accent)" : "var(--color-text-hint)" }}
        >
          {active ? (playing ? "🔊 sonando" : "⏸ pausado") : "🔊 leer"}
        </button>
      </div>
      <p className="text-sm" style={{ fontFamily: "var(--font-display)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {text}
      </p>
    </div>
  );
}

function AdventureIngestBanner({ ingest }: { ingest: AdventureIngest }) {
  const phaseLabel: Record<NonNullable<AdventureIngest["phase"]>, string> = {
    extracting: "Leyendo PDF",
    embedding: "Indexando fragmentos",
    summarizing: "Redactando esquema de la aventura",
    done: "Aventura lista",
    error: "Error",
  };
  const phase = ingest.phase ?? (ingest.status === "done" ? "done" : "extracting");
  const label = phaseLabel[phase];
  const total = ingest.total ?? 0;
  const done = ingest.done ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : phase === "done" ? 100 : 5;

  const isError = ingest.status === "error";
  const isDone = ingest.status === "done";
  const accent = isError
    ? "hsl(0,70%,55%)"
    : isDone
      ? "hsl(150,55%,55%)"
      : "var(--color-accent)";

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{
        border: `0.5px solid ${isError ? "rgba(216,90,48,0.45)" : "var(--color-border)"}`,
        background: isError ? "rgba(216,90,48,0.12)" : "var(--color-bg-secondary)",
        animation: "fadeUp 0.3s ease both",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="label" style={{ color: accent }}>
            {isDone ? "📘 Módulo cargado" : isError ? "⚠ Fallo al ingerir" : "📖 Ingestando tu módulo"}
          </p>
          <p className="mt-1 text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>
            {ingest.fileName ? <span>{ingest.fileName} · </span> : null}
            {isError
              ? ingest.error ?? "Ocurrió un error."
              : isDone
                ? "El DM usará esta aventura como verdad oficial durante toda la partida."
                : `${label}${total > 0 ? ` · ${done}/${total}` : ""}`}
          </p>
        </div>
        {!isDone && !isError && (
          <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
            {pct}%
          </span>
        )}
      </div>
      {!isDone && !isError && (
        <div
          className="mt-2 h-1 overflow-hidden rounded-full"
          style={{ background: "var(--color-bg-tertiary)" }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: accent,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      )}
      {!isDone && !isError && (
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
          El DM esperará a terminar la ingesta antes de abrir la aventura.
        </p>
      )}
    </div>
  );
}

function PlayerBubble({ name, text }: { name: string; text: string }) {
  return (
    <div>
      <p className="text-xs" style={{ color: "var(--color-text-hint)" }}>
        {name}
      </p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}
