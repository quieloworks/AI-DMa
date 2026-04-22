/**
 * Mide longitud (caracteres) del system/user del DM sin llamar a la API.
 * Uso: desde la raíz del repo: `npm run measure:dm-prompts`
 * O con perfil savings simulado: `DM_PROMPT_BUDGET=savings npm run measure:dm-prompts`
 */
import type { RetrievedChunk } from "../server/rag";
import type { AdventureChunk } from "../server/adventure";
import {
  buildAutoDmPrompt,
  buildAssistantDmPrompt,
  buildOpeningPrompt,
  DEFAULT_DM_RAG_RENDER_CAPS,
  type DmRagRenderCaps,
  type SessionSnapshot,
} from "../server/dm/prompts";

function approxTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

function fakeRules(n: number, fill: number): RetrievedChunk[] {
  const pad = "x".repeat(fill);
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    section: "Reglas",
    subsection: "Ejemplo",
    page: i + 1,
    text: pad,
    score: 0.1,
    source: "vec" as const,
  }));
}

function fakeAdventure(n: number, fill: number): AdventureChunk[] {
  const pad = "y".repeat(fill);
  return Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    story_id: "s1",
    section: "aventura",
    subsection: "Cap I",
    page: i + 1,
    text: pad,
    score: 0.1,
    source: "vec" as const,
  }));
}

const baseSnap: SessionSnapshot = {
  storyTitle: "Prueba de tokens",
  mode: "auto",
  turn: 3,
  summary: "Resumen de prueba ".repeat(20).trim(),
  players: [
    {
      id: "p1",
      name: "Aragorn",
      class: "Explorador",
      race: "Humano",
      level: 5,
      hp: { current: 42, max: 45, temp: 0 },
      ac: 16,
      notableItems: [],
      statusEffects: [],
      equipment: [
        { name: "Espada larga", qty: 1 },
        { name: "Antorcha", qty: 3 },
      ],
      spellsKnown: [
        { name: "Detectar magia", level: 1, prepared: true },
        { name: "Curar heridas", level: 1 },
      ],
      spellSlots: { "1": { max: 4, used: 1 }, "2": { max: 2, used: 0 } },
    },
    {
      id: "p2",
      name: "Gimli",
      class: "Guerrero",
      race: "Enano",
      level: 5,
      hp: { current: 50, max: 50, temp: 5 },
      ac: 18,
      notableItems: [],
      statusEffects: ["envenenado"],
      equipment: [],
    },
  ],
  recentLog: Array.from({ length: 8 }, (_, i) => `T${i} · evento sintético ${i} para medir longitud del bloque de log`),
  tone: 50,
  difficulty: "medio",
  initiative: [],
  seed: "semilla-de-prueba",
  adventureOutline: null,
  adventureChunks: undefined,
  adventureSourceName: null,
  combat: false,
};

function measure(label: string, messages: { role: string; content: string }[]) {
  const sys = messages.find((m) => m.role === "system")?.content ?? "";
  const usr = messages.find((m) => m.role === "user")?.content ?? "";
  const total = sys.length + usr.length;
  console.log(
    `${label.padEnd(36)} | system ${String(sys.length).padStart(6)} chars (~${approxTokens(sys.length)} tok) | user ${String(usr.length).padStart(5)} | total ~${approxTokens(total)} tok`
  );
}

const capsDefault: DmRagRenderCaps = DEFAULT_DM_RAG_RENDER_CAPS;
const capsSavings: DmRagRenderCaps = { rulesChunkChars: 600, adventureChunkChars: 800 };

const rulesFull = fakeRules(5, 900);
const advFull = fakeAdventure(6, 1200);

console.log("\n=== DM prompt sizes (synthetic RAG fills max slice per chunk) ===\n");

const snapPeace = { ...baseSnap, combat: false, initiative: [] };
measure("opening + default caps", buildOpeningPrompt({ ...snapPeace, adventureOutline: "Outline corto." }, rulesFull, capsDefault));
measure("opening + savings caps", buildOpeningPrompt({ ...snapPeace, adventureOutline: "Outline corto." }, rulesFull, capsSavings));

measure("player turn + default", buildAutoDmPrompt(snapPeace, rulesFull, { kind: "player", playerName: "Aragorn", text: "Miro alrededor buscando trampas." }, capsDefault));
measure("player + savings caps", buildAutoDmPrompt(snapPeace, rulesFull, { kind: "player", playerName: "Aragorn", text: "Miro alrededor buscando trampas." }, capsSavings));

const snapCombat = {
  ...baseSnap,
  combat: true,
  initiative: [
    { player_id: "p1", value: 18 },
    { player_id: "p2", value: 12 },
    { player_id: "npc:goblin-a", value: 14 },
  ],
  combatTracker: {
    round: 1,
    initiative_index: 0,
    turn_of: "p1",
    phase: "awaiting_dice" as const,
    note: "Tirada de ataque (espada larga)",
  },
};
measure("combat ON + default", buildAutoDmPrompt(snapCombat, rulesFull, { kind: "continue" }, capsDefault));
measure("combat ON + savings", buildAutoDmPrompt(snapCombat, rulesFull, { kind: "continue" }, capsSavings));

const snapModule = {
  ...snapPeace,
  adventureOutline: "**Premisa**: Ganchos de prueba.\n**NPCs**: A, B.",
  adventureChunks: fakeAdventure(4, 800),
  adventureSourceName: "modulo-falso.pdf",
};
measure("module + default", buildAutoDmPrompt(snapModule, fakeRules(5, 500), { kind: "continue" }, capsDefault));

measure("assistant + default", buildAssistantDmPrompt(snapCombat, rulesFull, "¿Qué CD para trepar el muro húmedo?", capsDefault));

console.log("\nPerfil activo en este proceso (RAG k/caps lee route en runtime; aquí solo caps explícitos):");
console.log(`  DM_PROMPT_BUDGET=${process.env.DM_PROMPT_BUDGET ?? "(unset=default en servidor)"}\n`);
