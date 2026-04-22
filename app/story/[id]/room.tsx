"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { parseDmResponse, streamingNarrativePreview } from "./parse";
import { MapCanvas, BattleMapCanvas, type BattleMap } from "./map";
import { QrPanel } from "./qr";
import { useLocale, useTranslations } from "@/components/LocaleProvider";

type Difficulty = "facil" | "medio" | "dificil" | "experto";
const DIFFICULTY_VALUES: Difficulty[] = ["facil", "medio", "dificil", "experto"];
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
  kind?: "public" | "private" | "dm-assistant";
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
  const tr = useTranslations();
  const locale = useLocale();
  const clientIdRef = useRef<string>(randomId());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [chat, setChat] = useState<ChatBubble[]>(() =>
    initialMessages.map((m) => {
      const kind: ChatBubble["kind"] =
        m.kind === "private" ? "private" : m.kind === "dm-assistant" ? "dm-assistant" : "public";
      let text = m.content;
      if (m.role === "dm" && kind === "public") {
        text = parseDmResponse(m.content).narrative.replace(/\[emocion:[^\]]+\]/gi, "").trim();
      }
      return {
        id: String(m.id),
        role: m.role as ChatBubble["role"],
        text,
        kind,
      };
    })
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
  /** Crónica compartida: narrativa y jugadores; sin susurros ni asistente técnico */
  const chronicle = useMemo(
    () => chat.filter((m) => m.kind !== "private" && m.kind !== "dm-assistant"),
    [chat]
  );
  /** Respuestas del asistente IA (solo DM; incluye bloque mecánico / acciones) */
  const assistantFeed = useMemo(() => chat.filter((m) => m.kind === "dm-assistant"), [chat]);
  /** Solo mensajes con kind private (DM ↔ jugador) */
  const whisperFeed = useMemo(() => chat.filter((m) => m.kind === "private"), [chat]);
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
      const ct = res.headers.get("content-type") ?? "";
      if (res.ok && ct.includes("application/json")) {
        const payload = (await res.json()) as { fallback?: string };
        if (payload.fallback !== "browser") return;
        // servidor sin TTS (say/espeak-ng no disponible): seguir a speechSynthesis abajo
      } else if (res.ok) {
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
    utter.lang = locale === "en" ? "en-US" : "es-ES";
    utter.rate = 0.95;
    utter.pitch = 0.95;
    setPlayer({ id, url: "", playing: true, duration: 0, current: 0 });
    utter.onend = () => setPlayer(null);
    window.speechSynthesis?.speak(utter);
  }, [locale]);

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
        if (msg.kind === "dm-assistant") {
          if (msg.originClientId === clientIdRef.current) return;
          setChat((prev) => [
            ...prev,
            {
              id: msg.id ?? randomId(),
              role: "dm",
              text: msg.text,
              kind: "dm-assistant",
            },
          ]);
          return;
        }
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
        if (msg.role === "dm" && autoSpeak && msg.text && msg.kind !== "private") {
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
        const who = evt.by.playerId
          ? playerMap[evt.by.playerId]?.character?.name ?? tr("storyRoom.playerFallback")
          : tr("storyRoom.dmShort");
        const labelBracket = evt.by.label ? ` (${evt.by.label})` : "";
        setChat((prev) => [
          ...prev,
          {
            id: randomId(),
            role: "system",
            text: tr("storyRoom.dice.roll", {
              who,
              expression: evt.result.expression,
              labelBracket,
              breakdown: evt.result.breakdown,
            }),
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
          const who = req.playerId
            ? playerMap[req.playerId]?.character?.name ?? tr("storyRoom.dice.playerAnonymous")
            : tr("storyRoom.dice.group");
          const labelParen = req.label ? ` (${req.label})` : "";
          const dcPart = req.dc ? ` — ${tr("storyRoom.dice.dcShort")} ${req.dc}` : "";
          setChat((prev) => [
            ...prev,
            {
              id: randomId(),
              role: "system",
              text: tr("storyRoom.dice.request", { who, expression: req.expression, labelParen, dcPart }),
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
  }, [sessionId, playerMap, autoSpeak, speakText, tr]);

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
        setChat((prev) => [...prev, { id: randomId(), role: "system", text: tr("storyRoom.system.continue") }]);
      }

      const dmId = randomId();
      const dmBubble: ChatBubble =
        story.mode === "assistant"
          ? { id: dmId, role: "dm", text: "", kind: "dm-assistant" }
          : { id: dmId, role: "dm", text: "" };
      setChat((prev) => [...prev, dmBubble]);
      if (autoSpeak && story.mode !== "assistant") speakQueueRef.current = dmId;

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
        if (!res.body) throw new Error(tr("storyRoom.stream.noBody"));
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const piece = decoder.decode(value, { stream: true });
          buffer += piece;
          const preview = story.mode === "assistant" ? buffer : streamingNarrativePreview(buffer);
          setChat((prev) => prev.map((m) => (m.id === dmId ? { ...m, text: preview } : m)));
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
        const finalDmText = story.mode === "assistant" ? buffer.trim() : clean;
        setChat((prev) => prev.map((m) => (m.id === dmId ? { ...m, text: finalDmText } : m)));
        if (payload.action === "opening") setOpeningDone(true);

        if (speakQueueRef.current === dmId && clean) {
          speakQueueRef.current = null;
          void speakText(dmId, clean);
        }
      } catch (err) {
        setChat((prev) =>
          prev.map((m) =>
            m.id === dmId ? { ...m, text: tr("storyRoom.stream.dmError", { message: (err as Error).message }) } : m
          )
        );
      } finally {
        setStreaming(false);
      }
    },
    [sessionId, story.mode, streaming, tone, difficulty, autoSpeak, speakText, combat, tr]
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

    if (story.mode === "auto" && whisperTo === "all") {
      const first = players[0];
      if (!socket || !first?.playerId) {
        setInput(text);
        return;
      }
      socket.emit("chat:send", {
        sessionId,
        role: "player",
        playerId: first.playerId,
        kind: "public",
        text,
        clientId: clientIdRef.current,
      });
      setChat((prev) => [
        ...prev,
        {
          id: randomId(),
          role: "player",
          text,
          playerName: first.character?.name ?? tr("storyRoom.playerFallback"),
          kind: "public",
        },
      ]);
      return;
    }

    const playerPid = players[0]?.playerId;
    const playerName = players[0]?.character?.name ?? tr("storyRoom.playerFallback");
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
      const hintForPrompt = sceneHint === "ninguno" ? tr("storyRoom.sceneHeroicFallback") : sceneHint;
      const prompt = [
        tr("storyRoom.image.scenePrompt1", { title: story.title }),
        tr("storyRoom.image.scenePrompt2", { hint: hintForPrompt }),
        lastDm ? tr("storyRoom.image.scenePrompt3", { excerpt: lastDm.slice(0, 500) }) : "",
        tr("storyRoom.image.sceneStyle"),
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
          tags: [tr("storyRoom.image.tagStory"), story.id, sceneHint, tr("storyRoom.image.tagScene")],
          size: "1536x1024",
          cacheKey: `story:${story.id}:scene:${hintKey}`,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? tr("storyRoom.image.genFailed"));
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
      const hintForCover = sceneHint === "ninguno" ? tr("storyRoom.sceneHeroicFallback") : sceneHint;
      const prompt = [
        tr("storyRoom.image.coverPrompt1", { title: story.title }),
        story.summary ? tr("storyRoom.image.coverPrompt2", { summary: story.summary.slice(0, 400) }) : "",
        tr("storyRoom.image.coverPrompt3", { hint: hintForCover }),
        tr("storyRoom.image.coverStyle"),
      ]
        .filter(Boolean)
        .join(" ");
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          title: `${story.title}${tr("storyRoom.image.coverTitleSuffix")}`,
          tags: [tr("storyRoom.image.tagStory"), story.id, tr("storyRoom.image.tagCover")],
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
  }, [coverImage, generatingCover, sceneHint, story.id, story.summary, story.title, tr]);

  function clearScene() {
    setSceneImage(null);
    void persistState({ sceneImage: null });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]" style={{ minHeight: "calc(100vh - 160px)" }}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="label">{tr("storyRoom.storyHeading")}</p>
            <h1 style={{ fontSize: 30 }}>{story.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge">{story.mode === "auto" ? tr("storyRoom.mode.auto") : tr("storyRoom.mode.assistant")}</span>
            {combat && (
              <span
                className="badge"
                style={{ background: "rgba(216,90,48,0.18)", color: "#f4a582", borderColor: "rgba(216,90,48,0.35)" }}
              >
                {tr("storyRoom.inCombat")}
              </span>
            )}
            {!coverImage && (
              <button
                type="button"
                onClick={() => void generateCover()}
                className="btn-ghost"
                disabled={generatingCover || generatingImage || combat}
                title={combat ? tr("storyRoom.cover.titleCombat") : tr("storyRoom.cover.titleIdle")}
              >
                {generatingCover ? tr("storyRoom.cover.generating") : tr("storyRoom.cover.generate")}
              </button>
            )}
            <button
              onClick={generateScene}
              className="btn-ghost"
              disabled={generatingImage || generatingCover || combat}
              title={combat ? tr("storyRoom.scene.titleCombat") : tr("storyRoom.scene.titleIdle")}
            >
              {generatingImage
                ? tr("storyRoom.scene.generating")
                : sceneImage
                  ? tr("storyRoom.scene.new")
                  : tr("storyRoom.scene.generate")}
            </button>
            {sceneImage && !combat && (
              <button onClick={clearScene} className="btn-ghost" title={tr("storyRoom.scene.backToCoverTitle")}>
                {tr("storyRoom.scene.backToCover")}
              </button>
            )}
            <button onClick={() => setShowQr((v) => !v)} className="btn-ghost">
              {showQr ? tr("storyRoom.qr.hide") : tr("storyRoom.qr.invite")}
            </button>
            <button
              onClick={() => setSettingsOpen((v) => !v)}
              className={settingsOpen ? "btn-accent" : "btn-ghost"}
              aria-expanded={settingsOpen}
            >
              {tr("storyRoom.settings")}
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
                  {tr("storyRoom.waitingDmMap")}
                </p>
              </div>
            </div>
          ) : sceneImage ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sceneImage} alt={tr("storyRoom.alt.scene")} className="h-full w-full object-cover" style={{ minHeight: 420 }} />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(15,14,12,0.55), transparent 45%)" }}
              />
              <div className="absolute left-3 top-3">
                <span
                  className="badge"
                  style={{ background: "rgba(15,14,12,0.55)", color: "#faf7f1", borderColor: "rgba(255,255,255,0.15)" }}
                >
                  {tr("storyRoom.sceneBadge")}
                </span>
              </div>
            </div>
          ) : coverImage ? (
            <div className="relative h-full w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverImage} alt={tr("storyRoom.alt.cover")} className="h-full w-full object-cover" style={{ minHeight: 420 }} />
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(15,14,12,0.65), transparent 55%)" }}
              />
              <div className="absolute bottom-4 left-5 right-5">
                <p
                  className="label"
                  style={{ color: "rgba(244,239,230,0.7)", letterSpacing: "0.14em" }}
                >
                  {tr("storyRoom.coverBadge")}
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
                  {tr("storyRoom.coverPaintingOverlay")}
                </div>
              )}
            </div>
          )}
          {imageError && (
            <div
              className="absolute bottom-3 left-3 right-3 rounded-md px-3 py-2 text-xs"
              style={{ background: "rgba(216, 90, 48, 0.2)", color: "#f4a582" }}
            >
              {imageError}
              {tr("storyRoom.imageErrorHint")}
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
                      {p.character?.race ?? "?"} · {p.character?.class ?? "?"} · {tr("storyNew.form.levelAbbr", { n: p.character?.level ?? 1 })}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: p.connected ? "var(--color-accent)" : "var(--color-text-hint)" }}>
                    {p.connected ? tr("storyRoom.online") : tr("storyRoom.offline")}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: "var(--color-text-hint)" }}>{tr("storyRoom.hp")}</span>
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
          <p className="label">{tr("storyRoom.chronicle")}</p>
          <span className="text-xs" style={{ color: "var(--color-text-hint)" }}>
            {tr("storyRoom.chronicle.inGroup", { n: chronicle.length })}
            {assistantFeed.length > 0 ? ` · ${tr("storyRoom.chronicle.assistant", { n: assistantFeed.length })}` : ""}
            {whisperFeed.length > 0 ? ` · ${tr("storyRoom.chronicle.whispers", { n: whisperFeed.length })}` : ""}
          </span>
        </div>

        {player && <AudioPlayer player={player} onToggle={togglePlay} onStop={stopPlay} onSeek={seekTo} liveLabel={tr("storyRoom.audio.live")} />}

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {chronicle.map((m) => (
            <div key={m.id}>
              {m.role === "dm" ? (
                <DmBubble
                  id={m.id}
                  text={m.text}
                  isPrivate={false}
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
                <PlayerBubble name={m.playerName ?? tr("storyRoom.playerFallback")} text={m.text} />
              )}
            </div>
          ))}
          {assistantFeed.length > 0 && (
            <div
              className="rounded-lg p-3"
              style={{
                border: "0.5px solid var(--color-border-strong)",
                background: "var(--color-bg-tertiary)",
              }}
            >
              <p className="label mb-2" style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                {tr("storyRoom.assistantDmOnly")}
              </p>
              <div className="space-y-3">
                {assistantFeed.map((m) => (
                  <pre
                    key={m.id}
                    className="whitespace-pre-wrap break-words text-xs"
                    style={{ color: "var(--color-text-primary)", fontFamily: "ui-monospace, monospace", margin: 0 }}
                  >
                    {m.text}
                  </pre>
                ))}
              </div>
            </div>
          )}
          {whisperFeed.length > 0 && (
            <div className="rounded-lg p-3" style={{ border: "0.5px solid var(--color-accent)", background: "var(--color-accent-bg)" }}>
              <p className="label mb-2" style={{ fontSize: 11, color: "var(--color-accent)" }}>
                {tr("storyRoom.whispersPrivate")}
              </p>
              <div className="space-y-3">
                {whisperFeed.map((m) => (
                  <div key={m.id}>
                    {m.role === "dm" ? (
                      <DmBubble
                        id={m.id}
                        text={m.text}
                        isPrivate
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
                      <PlayerBubble name={m.playerName ?? tr("storyRoom.playerFallback")} text={m.text} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {streaming && (
            <p className="text-xs italic" style={{ color: "var(--color-text-hint)" }}>
              {tr("storyRoom.dmTyping")}
            </p>
          )}
          <div ref={chatEnd} />
        </div>

        <div className="space-y-2 p-4" style={{ borderTop: "0.5px solid var(--color-border)" }}>
          <div className="flex items-center gap-2">
            <label className="label" style={{ fontSize: 10 }}>
              {tr("storyRoom.directTo")}
            </label>
            <select
              value={whisperTo}
              onChange={(e) => setWhisperTo(e.target.value)}
              className="input"
              style={{ height: 30, fontSize: 12, flex: 1 }}
            >
              <option value="all">{tr("storyRoom.option.wholeParty")}</option>
              {players.map((p) => (
                <option key={p.playerId} value={p.playerId}>
                  {tr("storyRoom.option.whisperTo", { name: p.character?.name ?? p.playerId })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              className="input"
              placeholder={
                whisperTo !== "all"
                  ? tr("storyRoom.placeholder.private", {
                      name: playerMap[whisperTo]?.character?.name ?? "",
                    })
                  : story.mode === "auto"
                    ? tr("storyRoom.placeholder.character")
                    : tr("storyRoom.placeholder.assistant")
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
              {streaming ? "…" : whisperTo !== "all" ? tr("storyRoom.whisperVerb") : tr("storyRoom.send")}
            </button>
          </div>
          {story.mode === "auto" && whisperTo === "all" && (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={continueStory}
                className="btn-ghost"
                style={{ flex: 1 }}
                disabled={streaming}
                title={tr("storyRoom.continueStoryTitle")}
              >
                {tr("storyRoom.continueStory")}
              </button>
              {!openingDone && (
                <button
                  onClick={() => runDm({ action: "opening" })}
                  className="btn-ghost"
                  style={{ flex: 1 }}
                  disabled={streaming}
                >
                  {tr("storyRoom.openAdventure")}
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
  const tr = useTranslations();
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
            <p className="label">{tr("storyRoom.settings.autoAudio")}</p>
            <p className="text-xs" style={{ color: "var(--color-text-hint)", maxWidth: 280 }}>
              {autoSpeak ? tr("storyRoom.settings.autoAudioOn") : tr("storyRoom.settings.autoAudioOff")}
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
  const tr = useTranslations();
  const idx = Math.max(0, DIFFICULTY_VALUES.indexOf(value));
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="label">{tr("storyRoom.difficulty.heading")}</p>
          <p className="text-sm" style={{ color: DIFFICULTY_COLOR[value] }}>
            {tr(`storyRoom.difficulty.${value}.label`)}
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
              {tr(`storyRoom.difficulty.${d}.label`).toLowerCase()}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
          {tr(`storyRoom.difficulty.${value}.sub`)}
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
  liveLabel,
}: {
  player: { id: string; playing: boolean; duration: number; current: number };
  onToggle: () => void;
  onStop: () => void;
  onSeek: (t: number) => void;
  liveLabel: string;
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
          <span>{player.duration ? formatTime(player.duration) : liveLabel}</span>
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
  const tr = useTranslations();
  const band =
    value <= 15
      ? tr("storyRoom.tone.band1")
      : value <= 35
        ? tr("storyRoom.tone.band2")
        : value <= 55
          ? tr("storyRoom.tone.band3")
          : value <= 75
            ? tr("storyRoom.tone.band4")
            : tr("storyRoom.tone.band5");
  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ border: "0.5px solid var(--color-border)", background: "var(--color-bg-tertiary)" }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="label">{tr("storyRoom.tone.heading")}</p>
          <p className="text-sm" style={{ color: toneGradient(value) }}>
            {band}
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
          <span>{tr("storyRoom.tone.axisLeft")}</span>
          <span>{tr("storyRoom.tone.axisMid")}</span>
          <span>{tr("storyRoom.tone.axisRight")}</span>
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
  const tr = useTranslations();
  const whisperTitle = isPrivate
    ? tr("storyRoom.bubble.whisper", {
        target: target ? tr("storyRoom.bubble.whisperTo", { name: target }) : "",
      })
    : tr("storyRoom.bubble.dm");
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
          {whisperTitle}
        </span>
        {!isPrivate ? (
          <button
            onClick={onSpeak}
            className="text-xs"
            style={{ color: active ? "var(--color-accent)" : "var(--color-text-hint)" }}
          >
            {active ? (playing ? tr("storyRoom.bubble.playing") : tr("storyRoom.bubble.paused")) : tr("storyRoom.bubble.read")}
          </button>
        ) : (
          <span className="text-[10px]" style={{ color: "var(--color-text-hint)" }}>
            {tr("storyRoom.bubble.noGroupAudio")}
          </span>
        )}
      </div>
      <p className="text-sm" style={{ fontFamily: "var(--font-display)", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {text}
      </p>
    </div>
  );
}

function AdventureIngestBanner({ ingest }: { ingest: AdventureIngest }) {
  const tr = useTranslations();
  const phaseLabel = (p: NonNullable<AdventureIngest["phase"]>) => {
    const key = `storyRoom.ingest.phase.${p}` as const;
    return tr(key);
  };
  const phase = ingest.phase ?? (ingest.status === "done" ? "done" : "extracting");
  const label = phaseLabel(phase);
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
            {isDone ? tr("storyRoom.ingest.title.done") : isError ? tr("storyRoom.ingest.title.error") : tr("storyRoom.ingest.title.running")}
          </p>
          <p className="mt-1 text-sm truncate" style={{ color: "var(--color-text-secondary)" }}>
            {ingest.fileName ? <span>{ingest.fileName} · </span> : null}
            {isError
              ? ingest.error ?? tr("storyRoom.ingest.errorGeneric")
              : isDone
                ? tr("storyRoom.ingest.doneDetail")
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
          {tr("storyRoom.ingest.waitHint")}
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
