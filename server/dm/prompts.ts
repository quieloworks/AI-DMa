import type { RetrievedChunk } from "../rag";
import type { AdventureChunk } from "../adventure";

export type SessionSnapshot = {
  storyTitle: string;
  mode: "auto" | "assistant";
  turn: number;
  summary?: string;
  players: Array<{
    id: string;
    name: string;
    class: string;
    race: string;
    level: number;
    hp: { current: number; max: number; temp: number };
    ac: number;
    notableItems: string[];
    statusEffects: string[];
    equipment?: Array<{ name: string; qty: number }>;
    spellsKnown?: Array<{ name: string; level: number; prepared?: boolean }>;
    spellSlots?: Record<string, { max: number; used: number }>;
  }>;
  sceneTags?: string[];
  recentLog?: string[];
  tone?: number;
  difficulty?: Difficulty;
  initiative?: Array<{ player_id: string; value: number }>;
  openingDone?: boolean;
  seed?: string;
  adventureOutline?: string | null;
  adventureChunks?: AdventureChunk[];
  adventureSourceName?: string | null;
  /** Sesión en combate (persistido en state_json). */
  combat?: boolean;
};

export type Difficulty = "facil" | "medio" | "dificil" | "experto";

export const DIFFICULTY_OPTIONS: Difficulty[] = ["facil", "medio", "dificil", "experto"];

export function normalizeDifficulty(raw: unknown): Difficulty {
  if (raw === "facil" || raw === "medio" || raw === "dificil" || raw === "experto") return raw;
  return "medio";
}

export type TurnAction =
  | { kind: "opening" }
  | { kind: "continue"; recentSignals?: string[] }
  | { kind: "player"; playerName: string; text: string };

/** Límites de caracteres por chunk al inyectar RAG en el system prompt. */
export type DmRagRenderCaps = {
  rulesChunkChars: number;
  adventureChunkChars: number;
};

export const DEFAULT_DM_RAG_RENDER_CAPS: DmRagRenderCaps = {
  rulesChunkChars: 900,
  adventureChunkChars: 1200,
};

function mergeRagCaps(partial?: Partial<DmRagRenderCaps>): DmRagRenderCaps {
  return {
    rulesChunkChars: partial?.rulesChunkChars ?? DEFAULT_DM_RAG_RENDER_CAPS.rulesChunkChars,
    adventureChunkChars: partial?.adventureChunkChars ?? DEFAULT_DM_RAG_RENDER_CAPS.adventureChunkChars,
  };
}

export function renderRulesContextForPrompt(chunks: RetrievedChunk[], caps: DmRagRenderCaps): string {
  if (!chunks.length) return "(sin reglas recuperadas)";
  const max = Math.max(120, caps.rulesChunkChars);
  return chunks
    .map(
      (c, i) =>
        `[R${i + 1} · ${c.section}${c.subsection ? " / " + c.subsection : ""} · p.${c.page}]\n${c.text.slice(0, max)}`
    )
    .join("\n\n");
}

export function renderAdventureChunksForPrompt(chunks: AdventureChunk[] | undefined, caps: DmRagRenderCaps): string {
  if (!chunks || !chunks.length) return "(sin fragmentos recuperados)";
  const max = Math.max(120, caps.adventureChunkChars);
  return chunks
    .map(
      (c, i) =>
        `[A${i + 1}${c.subsection ? " · " + c.subsection.slice(0, 80) : ""} · p.${c.page}]\n${c.text.slice(0, max)}`
    )
    .join("\n\n");
}

function renderPlayers(p: SessionSnapshot["players"]): string {
  return p
    .map((x) => {
      const head = `- [${x.id}] ${x.name} (${x.race} ${x.class} nv.${x.level}) · HP ${x.hp.current}/${x.hp.max}${x.hp.temp ? ` (+${x.hp.temp} temp)` : ""} · CA ${x.ac}${x.statusEffects.length ? ` · [${x.statusEffects.join(", ")}]` : ""}`;
      const eq = x.equipment?.length
        ? `\n    equipo: ${x.equipment
            .slice(0, 12)
            .map((e) => (e.qty > 1 ? `${e.qty}× ${e.name}` : e.name))
            .join(", ")}`
        : "";
      const spells = x.spellsKnown?.length
        ? `\n    conjuros: ${x.spellsKnown
            .slice(0, 10)
            .map((s) => `${s.name}(nv${s.level}${s.prepared ? "✓" : ""})`)
            .join(", ")}`
        : "";
      const slots = x.spellSlots && Object.keys(x.spellSlots).length
        ? `\n    slots: ${Object.entries(x.spellSlots)
            .map(([lvl, s]) => `nv${lvl} ${s.max - s.used}/${s.max}`)
            .join(", ")}`
        : "";
      return head + eq + spells + slots;
    })
    .join("\n");
}

function renderInitiative(snap: SessionSnapshot): string {
  if (!snap.initiative?.length) return "";
  const sorted = [...snap.initiative].sort((a, b) => b.value - a.value);
  return `INICIATIVA ACTIVA: ${sorted.map((i) => `${i.player_id}(${i.value})`).join(" > ")}`;
}

function isCombatWorkflow(snap: SessionSnapshot): boolean {
  return snap.combat === true || Boolean(snap.initiative?.length);
}

function difficultyGuide(difficulty: Difficulty | undefined): { label: string; directive: string } {
  const d = normalizeDifficulty(difficulty);
  if (d === "facil") {
    return {
      label: "Fácil",
      directive:
        "DIFICULTAD Fácil: CD habilidad 8-11, ataques enemigos +3/+4, salv CD 10-11; pocos enemigos, tácticas simples; pistas y recuperación generosas; evita bajar a 0 HP salvo fallos repetidos.",
    };
  }
  if (d === "dificil") {
    return {
      label: "Difícil",
      directive:
        "DIFICULTAD Difícil: CD habilidad 15-18, ataques +6/+8, salv CD 14-16; encuentros duros DMG, tácticas óptimas, entorno hostil; poca info gratis; 0 HP posible con reglas estrictas.",
    };
  }
  if (d === "experto") {
    return {
      label: "Experto",
      directive:
        "DIFICULTAD Experto: CD 17-22, ataques +8/+11, salv CD 16-19; límite mortal DMG; enemigos coordinados (concentración, control); recursos escasos; muerte permanente posible; reglas sin suavizar.",
    };
  }
  return {
    label: "Medio",
    directive:
      "DIFICULTAD Medio (5E): CD habilidad 12-14, ataques +5/+6, salv CD 13; encuentros DMG medio/difícil ocasional; tácticas sensatas con errores aprovechables; reto sin castigo gratuito.",
  };
}

function toneGuide(tone: number | undefined): { label: string; directive: string } {
  const t = Math.max(0, Math.min(100, tone ?? 50));
  if (t <= 15) {
    return {
      label: "Estricto",
      directive: "TONO Estricto: reglas Handbook al pie de la letra; prosa sobria; sin humor; tiradas 5E siempre.",
    };
  }
  if (t <= 35) {
    return {
      label: "Serio",
      directive: "TONO Serio: dramático, mecánica estricta, descripciones breves; sin humor gratuito.",
    };
  }
  if (t <= 55) {
    return {
      label: "Equilibrado",
      directive: "TONO Equilibrado: épico + reglas estrictas; NPCs con matices; reglas siempre como escritas.",
    };
  }
  if (t <= 75) {
    return {
      label: "Ocurrente",
      directive: "TONO Ocurrente: color e ironía ligera; reglas intactas en resolución.",
    };
  }
  return {
    label: "Bufonesco",
    directive: "TONO Bufonesco: humor/absurdo amable; reglas justas igualmente aplicadas.",
  };
}

const ENGAGEMENT_DIRECTIVES = `INTEGRACIÓN (cada turno): nombrar ≥2 jugadores si hay varios; sensorial por personaje; cierre con pregunta/dilema abierto; rotar foco respecto al turno anterior; consecuencias tangibles (social, físico, pistas).`;

const COMBAT_HINT = `COMBATE: si empieza combate, narra "COMBATE INICIA", pon combat:true, battle_map completo (grid, participants x/y, obstacles), pide iniciativa 1d20+DES en dice_requests; 1 celda≈5 pies (cellFeet típ. 5). Al terminar: combat:false y combat_end:true.`;

const COMBAT_DIRECTIVES = `COMBATE 5E (activo):
- Cada turno: battle_map actualizado con todos los vivos (x,y en celdas); obstáculos estables salvo cambio narrativo.
- Ronda: acción + bonus si aplica + reacción fuera de turno + movimiento = velocidad; 30 pies ≈ 6 celdas si cellFeet=5.
- Ataque: d20+mod+prof vs CA; daño en tirada aparte. Salvaciones: CD + atributo. Hechizos: nivel de slot, componentes, concentración.
- hp_changes reflejados también en battle_map.participants[].hp; status_effects y battle_map.participants[].status alineados.
- 0 HP: salvaciones de muerte por turno (1d20, 10+ éxito); status inconsciente en mapa hasta resuelto.`;

const MECHANICAL_DIRECTIVES = `FUERA DE COMBATE: tirada+CD si hay incertidumbre; ventaja/desventaja en dice_requests como 2d20kh1 / 2d20kl1; descansos corto/largo; recompensas xp_awards, items_add, items_remove.`;

const RESOLUTION_DIRECTIVE = `TIRADAS ANTES DEL RESULTADO: si el éxito no es obvio (ataque, conjuro, habilidad, salvación, etc.), PARA la narración antes del desenlace, pide dice_requests por player_id (no uses "all" salvo que todos tiren lo mismo), con expression XdY+Z, label y dc si aplica. No narres éxito/fracaso hasta el siguiente turno con resultados. Si no hay tirada, dilo y resuelve.`;

const FORMAT = `SALIDA (español): solo dos bloques.

<narrativa>
[emocion:epica|suspenso|calmo|urgente|misterio]
3-6 párrafos voz alta; [sfx:espadas|trueno|pasos|viento|rugido|taberna|fuego|campana] opcional. Cierra invitando a actuar.
</narrativa>

<acciones>
JSON (omitir claves vacías). Campos: scene, map{hint}, combat, battle_map{terrain,grid{cols,rows,cellFeet},participants[{id,name,kind,x,y,hp?,status?}],obstacles[{x,y,w,h,kind}]}, combat_end, initiative[{player_id,value}], dice_requests[{player_id,expression,label,dc?}], hp_changes[{player_id,delta,reason}], items_add/items_remove[{player_id,name,qty}], status_effects[{player_id,effect,add}], xp_awards[{player_id,amount}], spotlight[], summary_update, hooks[].
player_id: id de JUGADORES, "all", o "npc:…". Ej. mínimo: {"combat":false,"dice_requests":[{"player_id":"id","expression":"1d20+2","label":"Atletismo","dc":14}]}
</acciones>

Sin texto fuera de <narrativa>/<acciones>. No contradecir Handbook.

El chat del grupo solo muestra lo de <narrativa>; <acciones> es solo para la app/DM (nunca lo leas en voz alta al grupo).`;

const ADVENTURE_DIRECTIVE = `MÓDULO PDF = canon de ficción: ubicaciones, NPCs, encuentros y botín como en el texto; improvisar solo huecos coherentes; no contradecir hechos; fragmentos [A#] prevalecen; 5E gobierna mecánica, el módulo la trama.`;

function renderAdventureBlock(snap: SessionSnapshot, caps: DmRagRenderCaps): string {
  const hasOutline = Boolean(snap.adventureOutline && snap.adventureOutline.trim());
  const hasChunks = Boolean(snap.adventureChunks && snap.adventureChunks.length);
  if (!hasOutline && !hasChunks) return "";

  const header = `AVENTURA${snap.adventureSourceName ? ` (${snap.adventureSourceName})` : ""}`;
  const outline = hasOutline ? `\nESQUEMA:\n${snap.adventureOutline!.trim()}` : "";
  const chunks = hasChunks ? `\nFRAGMENTOS [A#]:\n${renderAdventureChunksForPrompt(snap.adventureChunks, caps)}` : "";
  return `${header}${outline}${chunks}\n${ADVENTURE_DIRECTIVE}`;
}

function sharedDirectiveTail(snap: SessionSnapshot, includeEngagement: boolean): string {
  const combatBlock = isCombatWorkflow(snap) ? COMBAT_DIRECTIVES : COMBAT_HINT;
  const parts: string[] = [];
  if (includeEngagement) parts.push(ENGAGEMENT_DIRECTIVES);
  parts.push(combatBlock, MECHANICAL_DIRECTIVES, RESOLUTION_DIRECTIVE, FORMAT);
  return parts.join("\n\n");
}

function baseSystem(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  toneLine: string,
  ragCaps: DmRagRenderCaps
): string {
  const init = renderInitiative(snap);
  const diff = difficultyGuide(snap.difficulty);
  const diffLine = `${diff.directive}\n(Dificultad: ${diff.label})`;
  const adventureBlock = renderAdventureBlock(snap, ragCaps);
  return `Eres un Dungeon Master experto de D&D 5E: historia memorable, justa y clara.

HISTORIA: ${snap.storyTitle}
MODO: ${snap.mode === "auto" ? "Automático (diriges todo)" : "Asistente del DM humano"}
TURNO: ${snap.turn}${snap.seed ? `\nSEMILLA: ${snap.seed}` : ""}${snap.summary ? `\nRESUMEN: ${snap.summary}` : ""}

JUGADORES:
${renderPlayers(snap.players)}
${init ? "\n" + init : ""}

${snap.recentLog?.length ? `EVENTOS RECIENTES:\n${snap.recentLog.slice(-8).join("\n")}` : ""}
${adventureBlock ? "\n" + adventureBlock + "\n" : ""}
HANDBOOK (mecánica):
${renderRulesContextForPrompt(rulesContext, ragCaps)}

${toneLine}

${diffLine}

${sharedDirectiveTail(snap, true)}`;
}

function assistantSystem(snap: SessionSnapshot, rulesContext: RetrievedChunk[], toneLine: string, ragCaps: DmRagRenderCaps): string {
  const diff = difficultyGuide(snap.difficulty);
  const adventureBlock = renderAdventureBlock(snap, ragCaps);
  return `Asistente técnico del DM humano (D&D 5E). Sin narrar al grupo: respuestas breves, reglas, CDs, iniciativa, estado. Formato obligatorio abajo.

HISTORIA: ${snap.storyTitle}
TURNO: ${snap.turn}${snap.summary ? `\nCONTEXTO: ${snap.summary}` : ""}

JUGADORES:
${renderPlayers(snap.players)}
${renderInitiative(snap) ? "\n" + renderInitiative(snap) : ""}

${adventureBlock ? adventureBlock + "\n\n" : ""}HANDBOOK:
${renderRulesContextForPrompt(rulesContext, ragCaps)}

${toneLine}

${diff.directive}\n(Dificultad: ${diff.label})

${sharedDirectiveTail(snap, false)}

En <narrativa>: nota corta para el DM (no leer al grupo). En <acciones>: dice_requests, iniciativa, etc. según proceda.`;
}

export function buildOpeningPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  ragCaps: Partial<DmRagRenderCaps> = {}
) {
  const caps = mergeRagCaps(ragCaps);
  const { label, directive } = toneGuide(snap.tone);
  const system = baseSystem(snap, rulesContext, `${directive}\n(Tono: ${label}, ${snap.tone ?? 50}/100)`, caps);

  const names = snap.players.map((p) => `${p.name} (${p.race} ${p.class})`).join(", ");
  const hasModule = Boolean(
    (snap.adventureOutline && snap.adventureOutline.trim()) ||
      (snap.adventureChunks && snap.adventureChunks.length)
  );
  const moduleDirective = hasModule
    ? `\n\nMÓDULO CARGADO: abre donde el módulo empieza (esquema + [A#]); respeta nombres y hechos; integra a (${names || "aventureros"}); no adelantes revelaciones posteriores.`
    : `\n\nSi hay SEMILLA, respétala; si es vaga, premisa coherente con PJ y tono.`;

  const user = `Inicia la historia AHORA (apertura cinematográfica, formato narrativa+acciones).

Orden: (1) dónde/cuándo/sensorial (2) quiénes por nombre (${names || "aventureros"}) (3) por qué están juntos (4) gancho/conflicto (5) invitación concreta a ≥2 jugadores.${moduleDirective}`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function buildAutoDmPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  action: TurnAction,
  ragCaps: Partial<DmRagRenderCaps> = {}
) {
  const caps = mergeRagCaps(ragCaps);
  const { label, directive } = toneGuide(snap.tone);
  const system = baseSystem(snap, rulesContext, `${directive}\n(Tono: ${label}, ${snap.tone ?? 50}/100)`, caps);

  let user = "";
  if (action.kind === "opening") {
    return buildOpeningPrompt(snap, rulesContext, caps);
  }
  if (action.kind === "continue") {
    user = `Continúa desde el último momento narrativo.
- Una frase resume lo que plantearon los jugadores (si hubo mensajes).
- Avanza escena: resuelve tiradas pendientes, consecuencias, nuevo estímulo o cierre de subescena; respeta iniciativa en combate.
- Invita a actuar rotando foco.${action.recentSignals?.length ? `\nSeñales:\n- ${action.recentSignals.join("\n- ")}` : ""}`;
  } else {
    user = `Jugador ${action.playerName}: ${action.text}

Flujo: (1) quiénes se afectan (2) si hay incertidumbre, PARA antes del resultado, dice_requests por player_id (3) no narres éxito/fracaso hasta dados (4) si no hay tirada, explica y resuelve.
CD y tipo explícitos. Sensorial para ${action.playerName} sin adelantar resultado de tiradas pendientes.`;
  }

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function buildAssistantDmPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  dmMessage: string,
  ragCaps: Partial<DmRagRenderCaps> = {}
) {
  const caps = mergeRagCaps(ragCaps);
  const { label, directive } = toneGuide(snap.tone);
  const system = assistantSystem(snap, rulesContext, `${directive}\n(Tono: ${label}, ${snap.tone ?? 50}/100)`, caps);

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: `DM: ${dmMessage}` },
  ];
}

export function parseDmResponse(raw: string): {
  narrative: string;
  actions: Record<string, unknown>;
  emotion?: string;
} {
  const narrativa = /<narrativa>([\s\S]*?)<\/narrativa>/i.exec(raw)?.[1]?.trim() ?? raw;
  const acciones = /<acciones>([\s\S]*?)<\/acciones>/i.exec(raw)?.[1]?.trim() ?? "{}";
  const emotion = /\[emocion:([^\]]+)\]/i.exec(narrativa)?.[1]?.trim();
  let actions: Record<string, unknown> = {};
  try {
    actions = JSON.parse(acciones);
  } catch {
    try {
      actions = JSON.parse(acciones.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      actions = {};
    }
  }
  return { narrative: narrativa, actions, emotion };
}
