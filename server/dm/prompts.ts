import type { RetrievedChunk } from "../rag";

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
  initiative?: Array<{ player_id: string; value: number }>;
  openingDone?: boolean;
  seed?: string;
};

export type TurnAction =
  | { kind: "opening" }
  | { kind: "continue"; recentSignals?: string[] }
  | { kind: "player"; playerName: string; text: string };

function renderRulesContext(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "(sin reglas recuperadas)";
  return chunks
    .map((c, i) => `[R${i + 1} · ${c.section}${c.subsection ? " / " + c.subsection : ""} · p.${c.page}]\n${c.text.slice(0, 900)}`)
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

function toneGuide(tone: number | undefined): { label: string; directive: string } {
  const t = Math.max(0, Math.min(100, tone ?? 50));
  if (t <= 15) {
    return {
      label: "Estricto",
      directive:
        "TONO: riguroso y solemne. Apégate al pie de la letra a las reglas recuperadas del Handbook. Prosa sobria, poca ornamentación, cero bromas. Cada acción exige su tirada correcta según 5E.",
    };
  }
  if (t <= 35) {
    return {
      label: "Serio",
      directive:
        "TONO: serio y cinematográfico. Narra con peso dramático y respeto absoluto por las mecánicas. Usa descripciones cortas pero evocadoras. Nada de humor gratuito.",
    };
  }
  if (t <= 55) {
    return {
      label: "Equilibrado",
      directive:
        "TONO: mezcla narrativa épica y mecánica rigurosa. NPCs con matices; guiños ocasionales sin romper la tensión. Siempre aplicas las reglas tal como están escritas.",
    };
  }
  if (t <= 75) {
    return {
      label: "Ocurrente",
      directive:
        "TONO: vivaz y ocurrente. NPCs carismáticos, detalles coloridos, comparaciones inesperadas. Puedes soltar ironía o chistes ligeros. Las reglas se respetan; la forma puede improvisar.",
    };
  }
  return {
    label: "Bufonesco",
    directive:
      "TONO: alocado y cómico. Mundo cartoon, NPCs absurdos, guiños meta. Puedes bromear con los jugadores sin faltarles. Las mecánicas siguen siendo justas: las reglas se aplican, pero las descripciones rompen la cuarta pared con cariño.",
  };
}

const ENGAGEMENT_DIRECTIVES = `INTEGRACIÓN DEL GRUPO (obligatorio cada turno):
- Dirígete por nombre al menos a 2 jugadores distintos cuando haya varios en escena.
- Usa los sentidos: describe lo que cada jugador ve, huele, escucha o siente físicamente.
- Termina la narrativa con una pregunta abierta al grupo o un dilema que exija decisión (por ejemplo: "¿Cómo actúas, {nombre}?" o "¿Qué arriesgas para evitarlo?").
- Si un jugador llevó el turno anterior, invita explícitamente a otro en este turno.
- Haz que las consecuencias sean palpables: refleja estado físico, repercusiones sociales, pistas perdidas o ganadas.`;

const COMBAT_DIRECTIVES = `MECÁNICAS DE COMBATE (D&D 5E):
- Si se inicia combate, declara "COMBATE INICIA" en la narrativa, pide TIRADAS DE INICIATIVA (1d20+DEX) a todos los involucrados y devuelve el orden propuesto en "actions.initiative".
- Respeta el orden de iniciativa: 1 turno por ronda = 1 acción + 1 acción bonus (si aplica) + 1 reacción (fuera de turno) + movimiento igual a velocidad.
- Ataques: solicita tirada de ataque (d20 + mod + proficiencia) vs CA del objetivo; si impacta, pide tirada de daño con el dado del arma/conjuro.
- Salvaciones: declara la CD y qué atributo (FUE/DES/CON/INT/SAB/CAR). Pide "1d20+mod".
- Hechizos con slot: menciona nivel del hechizo, componentes, concentración si aplica.
- Actualiza HP vía "hp_changes" cuando un ataque conecte o un efecto aplique.
- Condiciones (envenenado, derribado, etc.) van en "status_effects" con "add":true/false.
- Si alguien cae a 0 HP: pide salvaciones de muerte cada turno (1d20, 10+ = éxito).`;

const MECHANICAL_DIRECTIVES = `MECÁNICAS FUERA DE COMBATE:
- Para acciones con incertidumbre solicita la tirada correspondiente con su CD (Sigilo vs Percepción pasiva, Persuasión CD 15, Atletismo para escalar, etc.).
- Ventaja/Desventaja: díselo al jugador en la narrativa y resuélvela en "dice_requests" con la expresión "2d20kh1" o "2d20kl1".
- Descansos: recuerda al grupo los descansos cortos (1h, dados de golpe) y largos (8h, HP y slots restaurados).
- Xp/Oro/Objetos: entrega recompensas con "xp_awards", "items_add", "items_remove".`;

const RESOLUTION_DIRECTIVE = `RESOLUCIÓN DE ACCIONES (OBLIGATORIO, ANTES DE NARRAR EL RESULTADO):
- Cuando un jugador, NPC o criatura intente una acción cuyo éxito NO es automático — ataques, conjuros ofensivos, sigilo, persuasión, escalar, forzar cerraduras, romper algo, esquivar una trampa, resistir un efecto, etc. — DEBES declarar la incertidumbre, interrumpir la narración y pedir la tirada adecuada ANTES de describir el desenlace.
- Usa SIEMPRE el array "dice_requests" en <acciones>. Cada entrada DEBE indicar el "player_id" específico del afectado (o "all" sólo si TODOS tiran lo mismo), "expression" con notación XdY+Z, "label" describiendo la prueba y "dc" cuando exista.
- Si varios personajes se ven afectados (p. ej. explosión, niebla, canción), emite un "dice_requests" separado por cada player_id en vez de "all" para que cada jugador reciba su tirada personalizada.
- NO inventes ni narres el resultado antes de la tirada: termina la narrativa con la pregunta/CD y deja claro que espera el resultado (ej. "Tira Destreza CD 14 para saltar").
- Sólo en el siguiente turno, cuando el servidor entregue los resultados de dados, describe el desenlace real.
- Si la acción no requiere tirada (es automática o imposible), dilo explícitamente y justifica según las reglas.`;

const FORMAT = `FORMATO DE SALIDA (ESTRICTO, en ESPAÑOL):
Responde SIEMPRE con exactamente dos bloques:

<narrativa>
[emocion:epica|suspenso|calmo|urgente|misterio]
Texto para leer en voz alta al grupo (3-6 párrafos máximo). Vívido, inmersivo, directo a los jugadores.
Puedes salpicar [sfx:espadas|trueno|pasos|viento|rugido|taberna|fuego|campana] donde corresponda.
SIEMPRE cierra con una invitación clara a uno o más jugadores para que actúen.
</narrativa>

<acciones>
{
  "scene": "descripción breve de la escena actual",
  "map": { "hint": "bosque|mazmorra|taberna|camino|ciudad|castillo|subterraneo|costa|ninguno" },
  "combat": false,
  "initiative": [ {"player_id": "id|npc:goblin-a", "value": 17} ],
  "dice_requests": [
    {"player_id": "id|all", "expression": "1d20+3", "label": "Percepción pasiva vs 12", "dc": 12}
  ],
  "hp_changes": [ {"player_id": "id", "delta": -4, "reason": "golpe de goblin"} ],
  "items_add": [ {"player_id": "id|all", "name": "Poción de curación", "qty": 1} ],
  "items_remove": [ {"player_id": "id", "name": "Antorcha"} ],
  "status_effects": [ {"player_id": "id", "effect": "envenenado", "add": true} ],
  "xp_awards": [ {"player_id": "id|all", "amount": 50} ],
  "spotlight": ["id_jugador_para_el_siguiente_turno"],
  "summary_update": "qué pasó este turno en una frase",
  "hooks": ["pista pendiente", "NPC que espera respuesta"]
}
</acciones>

REGLAS DEL FORMATO:
- NUNCA escribas texto fuera de los bloques <narrativa> y <acciones>.
- NUNCA contradigas las reglas recuperadas del Handbook.
- Cuando pidas tiradas, usa notación XdY+Z y marca la CD cuando exista.
- "player_id" acepta el id literal de cada jugador (mostrado arriba en JUGADORES), "all" para todos, o "npc:nombre" para criaturas.
- Omite campos vacíos en lugar de mandar arrays/objetos vacíos.`;

function baseSystem(snap: SessionSnapshot, rulesContext: RetrievedChunk[], toneLine: string): string {
  const init = renderInitiative(snap);
  return `Eres un Dungeon Master experto de D&D 5E. Tu misión es conducir a un grupo real a través de una historia memorable, justa y emocionante.

HISTORIA: ${snap.storyTitle}
MODO: ${snap.mode === "auto" ? "Automático (tú diriges todo)" : "Asistente del DM humano"}
TURNO: ${snap.turn}${snap.seed ? `\nSEMILLA DE AVENTURA: ${snap.seed}` : ""}${snap.summary ? `\nRESUMEN HASTA AHORA: ${snap.summary}` : ""}

JUGADORES:
${renderPlayers(snap.players)}
${init ? "\n" + init : ""}

${snap.recentLog?.length ? `ÚLTIMOS EVENTOS:\n${snap.recentLog.slice(-8).join("\n")}` : ""}

REGLAS RELEVANTES DEL HANDBOOK (usa como verdad):
${renderRulesContext(rulesContext)}

${toneLine}

${ENGAGEMENT_DIRECTIVES}

${COMBAT_DIRECTIVES}

${MECHANICAL_DIRECTIVES}

${RESOLUTION_DIRECTIVE}

${FORMAT}`;
}

export function buildOpeningPrompt(snap: SessionSnapshot, rulesContext: RetrievedChunk[]) {
  const { label, directive } = toneGuide(snap.tone);
  const system = baseSystem(snap, rulesContext, `${directive}\n(Nivel de tono seleccionado: ${label} — intensidad ${snap.tone ?? 50}/100)`);

  const names = snap.players.map((p) => `${p.name} (${p.race} ${p.class})`).join(", ");
  const user = `Inicia la historia AHORA con una escena de apertura cinematográfica. Responde con el formato obligatorio (narrativa + acciones).

Tu apertura DEBE cubrir, en este orden:
1. DÓNDE y CUÁNDO: ubicación concreta, hora del día, clima, atmósfera sensorial.
2. QUIÉNES: presenta a los jugadores por nombre e integra quién es cada uno en la escena inicial (${names || "los aventureros"}).
3. POR QUÉ están juntos: el vínculo o contrato que los une en este momento.
4. QUÉ está pasando: el gancho — un conflicto, rumor, encargo o peligro que acaba de irrumpir.
5. CÓMO pueden actuar: una invitación clara a actuar dirigida a al menos dos jugadores por nombre (preguntas concretas, no genéricas).

Si la SEMILLA DE AVENTURA existe, respétala como premisa. Si es vaga o falta, invéntala coherente con los personajes y el tono.`;

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function buildAutoDmPrompt(
  snap: SessionSnapshot,
  rulesContext: RetrievedChunk[],
  action: TurnAction
) {
  const { label, directive } = toneGuide(snap.tone);
  const system = baseSystem(snap, rulesContext, `${directive}\n(Nivel de tono seleccionado: ${label} — intensidad ${snap.tone ?? 50}/100)`);

  let user = "";
  if (action.kind === "opening") {
    return buildOpeningPrompt(snap, rulesContext);
  }
  if (action.kind === "continue") {
    user = `El grupo ha hablado y reaccionado. Continúa la historia desde el último momento narrativo.
- Resume con una frase lo que los jugadores acaban de plantear (si hubo mensajes).
- Avanza la escena: resuelve tiradas pendientes con resultados lógicos, revela consecuencias, introduce nuevo estímulo (aliado/enemigo/descubrimiento) o cierra la subescena.
- Respeta la iniciativa si hay combate.
- Vuelve a invitar a actuar a jugadores específicos, rotando el foco.${action.recentSignals?.length ? `\n\nSeñales del grupo:\n- ${action.recentSignals.join("\n- ")}` : ""}`;
  } else {
    user = `Jugador ${action.playerName}: ${action.text}

Procesa la acción aplicando las reglas 5E siguiendo este flujo OBLIGATORIO:
1. Identifica quién se ve afectado (el jugador que actúa, otros jugadores, NPCs, grupo entero).
2. Si el resultado NO es automático, DETÉN la narración en el momento crítico, describe la situación sensorialmente y solicita las tiradas necesarias en "dice_requests" asignadas al "player_id" específico de cada afectado (usa "all" sólo si realmente todos tiran lo mismo).
3. NO narres aún si tuvo éxito o fracaso — espera los dados del siguiente turno.
4. Si la acción no requiere tirada (automática o imposible), explica por qué en la narrativa y resuélvela.

Sé explícito en la CD y el tipo de tirada (habilidad/atributo/ataque/salvación). Describe consecuencias sensoriales para ${action.playerName} y cómo lo perciben los demás, sin adelantar el resultado de los dados pendientes.`;
  }

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function buildAssistantDmPrompt(snap: SessionSnapshot, rulesContext: RetrievedChunk[], dmMessage: string) {
  const { label, directive } = toneGuide(snap.tone);
  const system = `Eres el asistente técnico del Dungeon Master humano en una partida de D&D 5E.
El DM te da instrucciones; tu rol es ayudarle calculando reglas, listando opciones de ataque/defensa, sugiriendo CDs, manteniendo iniciativa y estado consistente. NO narras al grupo; respondes breve, técnico y útil.

HISTORIA: ${snap.storyTitle}
TURNO: ${snap.turn}${snap.summary ? `\nCONTEXTO: ${snap.summary}` : ""}

JUGADORES:
${renderPlayers(snap.players)}
${renderInitiative(snap) ? "\n" + renderInitiative(snap) : ""}

REGLAS RELEVANTES:
${renderRulesContext(rulesContext)}

${directive}\n(Tono seleccionado: ${label} — ${snap.tone ?? 50}/100)

${COMBAT_DIRECTIVES}
${MECHANICAL_DIRECTIVES}

${RESOLUTION_DIRECTIVE}

${FORMAT}

En <narrativa> incluye una nota breve para el DM humano (no para leer al grupo). En <acciones> llena lo que proceda (dice_requests con CD, iniciativa, etc.).`;

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
