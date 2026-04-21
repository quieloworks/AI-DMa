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

function renderRulesContext(chunks: RetrievedChunk[]): string {
  if (!chunks.length) return "(sin reglas recuperadas)";
  return chunks
    .map((c, i) => `[R${i + 1} · ${c.section}${c.subsection ? " / " + c.subsection : ""} · p.${c.page}]\n${c.text.slice(0, 900)}`)
    .join("\n\n");
}

function renderAdventureChunks(chunks: AdventureChunk[] | undefined): string {
  if (!chunks || !chunks.length) return "(sin fragmentos recuperados)";
  return chunks
    .map(
      (c, i) =>
        `[A${i + 1}${c.subsection ? " · " + c.subsection.slice(0, 80) : ""} · p.${c.page}]\n${c.text.slice(0, 1200)}`
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

function difficultyGuide(difficulty: Difficulty | undefined): { label: string; directive: string } {
  const d = normalizeDifficulty(difficulty);
  if (d === "facil") {
    return {
      label: "Fácil",
      directive:
        "DIFICULTAD: Fácil. Los jugadores son aprendices o quieren una tarde relajada.\n- CD típicas bajas: pruebas de habilidad CD 8-11, ataques de enemigos con +3/+4, CDs de salvación 10-11.\n- Encuentros con 1-2 criaturas de CR inferior al nivel del grupo (o equivalente ≤ 1/4 del umbral 'medio' del DMG).\n- Enemigos con tácticas simples, sin sinergias crueles; priorizan blancos obvios.\n- Recursos generosos: pistas claras, NPCs colaboradores, botín de pociones/curaciones frecuente.\n- Describe el riesgo, pero deja márgenes de recuperación. Concede inspiración cuando un jugador narre bien.\n- Nunca un personaje debería caer a menos de que falle varias veces seguidas; prefiere acciones que lo dejen herido pero consciente.",
    };
  }
  if (d === "dificil") {
    return {
      label: "Difícil",
      directive:
        "DIFICULTAD: Difícil. Los jugadores buscan un reto genuino.\n- CDs habituales: habilidad CD 15-18, ataques enemigos +6/+8, salvaciones CD 14-16.\n- Encuentros pensados al límite 'difícil' del DMG: múltiples enemigos o un élite con CR superior al nivel.\n- Los enemigos usan tácticas óptimas: foco en objetivos frágiles, cobertura, concentración, sinergias, emboscadas.\n- Entorno hostil: terreno difícil, trampas con CD altas, recursos limitados (pocas pociones, descanso interrumpido).\n- Sé avaro con la información gratuita; exige tiradas para pistas. Mantén consecuencias estrictas.\n- Los críticos enemigos y fallos masivos pueden dejar a un PC a 0 HP; respeta las reglas de muerte sin suavizar.",
    };
  }
  if (d === "experto") {
    return {
      label: "Experto",
      directive:
        "DIFICULTAD: Experto. Es una partida de veteranos que buscan un desafío brutal y justo.\n- CDs punitivas: habilidad CD 17-22, ataques enemigos +8/+11, salvaciones CD 16-19.\n- Encuentros al límite 'mortal' del DMG o ligeramente por encima; combate como ajedrez con piezas que matan.\n- Enemigos con tácticas coordinadas, acciones legendarias, guardia, concentración cruzada, interrupciones y control de área.\n- Recursos extremadamente escasos; descansos largos arriesgados; objetos mágicos selectivos y pocos.\n- El grupo debe planificar: recompensa la preparación, explora debilidades del enemigo, penaliza la improvisación torpe.\n- La muerte permanente es una posibilidad real. No suavices las reglas; haz cumplir concentración, iniciativa, reacciones, componentes.",
    };
  }
  return {
    label: "Medio",
    directive:
      "DIFICULTAD: Medio (5E por defecto).\n- CDs centrales: habilidad CD 12-14, ataques enemigos +5/+6, salvaciones CD 13.\n- Encuentros balanceados según la guía del DMG ('medio' o 'difícil' ocasional).\n- Enemigos con tácticas sensatas pero no óptimas; cometen errores aprovechables.\n- Recursos equilibrados: algunas pociones, descansos posibles con costo narrativo.\n- Mantén el reto sin castigar innecesariamente; el grupo puede salir herido pero funcional si juega con cuidado.",
  };
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
- Si se inicia combate, declara "COMBATE INICIA" en la narrativa, pon "combat": true y llena "battle_map" completo (grid, participants con x/y en celdas, obstáculos). Pide TIRADAS DE INICIATIVA (1d20+DEX) y devuelve el orden propuesto en "initiative".
- Mientras "combat" sea true, actualiza "battle_map" CADA TURNO con las posiciones nuevas de cada participante (x, y en celdas de ${"`cellFeet`"} pies cada una, típicamente 5). Incluye a TODOS los que sigan en escena — jugadores, aliados, enemigos. No omitas a nadie que siga vivo.
- Respeta la escala: 1 celda = 5 pies. La velocidad base (30 pies) equivale a 6 celdas por turno. Describe distancias coherentes con el mapa.
- Coloca obstáculos relevantes (muros, cobertura, fuego, agua, muebles) en "battle_map.obstacles" con x, y, w, h (rectángulos en celdas). Mantén la lista estable entre turnos salvo que algo cambie (p. ej. un muro derribado).
- Cuando el combate termine (enemigos muertos/rendidos/huidos o tregua), pon "combat": false y "combat_end": true en el mismo turno. Ya no hace falta seguir enviando battle_map después.
- Respeta el orden de iniciativa: 1 turno por ronda = 1 acción + 1 acción bonus (si aplica) + 1 reacción (fuera de turno) + movimiento igual a velocidad.
- Ataques: solicita tirada de ataque (d20 + mod + proficiencia) vs CA del objetivo; si impacta, pide tirada de daño con el dado del arma/conjuro.
- Salvaciones: declara la CD y qué atributo (FUE/DES/CON/INT/SAB/CAR). Pide "1d20+mod".
- Hechizos con slot: menciona nivel del hechizo, componentes, concentración si aplica.
- Actualiza HP vía "hp_changes" cuando un ataque conecte o un efecto aplique. Refleja esos HP también en battle_map.participants[].hp.
- Condiciones (envenenado, derribado, etc.) van en "status_effects" con "add":true/false y se pueden reflejar en battle_map.participants[].status.
- Si alguien cae a 0 HP: pide salvaciones de muerte cada turno (1d20, 10+ = éxito). Mantén al personaje en el mapa como "inconsciente" en status hasta que se decida su suerte.`;

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
  "battle_map": {
    "terrain": "bosque|mazmorra|taberna|camino|ciudad|castillo|subterraneo|costa|ninguno",
    "grid": { "cols": 20, "rows": 12, "cellFeet": 5 },
    "participants": [
      { "id": "id_jugador|npc:goblin-a", "name": "Nombre", "kind": "player|ally|enemy|neutral", "x": 4, "y": 6, "hp": {"current": 11, "max": 11}, "status": ["oculto"] }
    ],
    "obstacles": [
      { "x": 8, "y": 4, "w": 1, "h": 3, "kind": "wall|rock|tree|water|door|fire|cover|table|pillar" }
    ]
  },
  "combat_end": false,
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

const ADVENTURE_DIRECTIVE = `MÓDULO CARGADO (SOURCE OF TRUTH):
- El usuario cargó un PDF con la aventura escrita. Lo que ese módulo dice es CANON.
- Dirige la partida según el módulo: respeta ubicaciones, NPCs, encuentros, tesoros, secretos y ritmo tal como aparecen.
- Solo improvisa cuando el módulo NO cubra una situación (acción creativa del jugador, detalle menor no escrito, reacción de un NPC fuera de guion). En ese caso, mantén tono, lógica y continuidad del módulo.
- NO inventes nombres, monstruos, CDs, botines, pistas o finales que contradigan el módulo. Si algo no está, dilo implícitamente improvisando coherente, pero nunca uses información inventada como si fuera oficial.
- Si los jugadores se desvían del camino previsto, úsalo como oportunidad narrativa sin romper los hechos establecidos.
- Cuando una sección recuperada del módulo (marcada [A#]) aplique, apégate al texto.
- Las reglas de D&D 5E siguen siendo fuente secundaria para mecánicas; el módulo manda en la ficción.`;

function renderAdventureBlock(snap: SessionSnapshot): string {
  const hasOutline = Boolean(snap.adventureOutline && snap.adventureOutline.trim());
  const hasChunks = Boolean(snap.adventureChunks && snap.adventureChunks.length);
  if (!hasOutline && !hasChunks) return "";

  const header = `AVENTURA CARGADA${snap.adventureSourceName ? ` (fuente: ${snap.adventureSourceName})` : ""}:`;
  const outline = hasOutline ? `\nESQUEMA OFICIAL DEL MÓDULO:\n${snap.adventureOutline!.trim()}` : "";
  const chunks = hasChunks
    ? `\nFRAGMENTOS RELEVANTES DEL MÓDULO (cita-los al dirigir):\n${renderAdventureChunks(snap.adventureChunks)}`
    : "";
  return `${header}${outline}${chunks}\n\n${ADVENTURE_DIRECTIVE}`;
}

function baseSystem(snap: SessionSnapshot, rulesContext: RetrievedChunk[], toneLine: string): string {
  const init = renderInitiative(snap);
  const diff = difficultyGuide(snap.difficulty);
  const diffLine = `${diff.directive}\n(Dificultad seleccionada: ${diff.label})`;
  const adventureBlock = renderAdventureBlock(snap);
  return `Eres un Dungeon Master experto de D&D 5E. Tu misión es conducir a un grupo real a través de una historia memorable, justa y emocionante.

HISTORIA: ${snap.storyTitle}
MODO: ${snap.mode === "auto" ? "Automático (tú diriges todo)" : "Asistente del DM humano"}
TURNO: ${snap.turn}${snap.seed ? `\nSEMILLA DE AVENTURA: ${snap.seed}` : ""}${snap.summary ? `\nRESUMEN HASTA AHORA: ${snap.summary}` : ""}

JUGADORES:
${renderPlayers(snap.players)}
${init ? "\n" + init : ""}

${snap.recentLog?.length ? `ÚLTIMOS EVENTOS:\n${snap.recentLog.slice(-8).join("\n")}` : ""}
${adventureBlock ? "\n" + adventureBlock + "\n" : ""}
REGLAS RELEVANTES DEL HANDBOOK (usa como verdad mecánica):
${renderRulesContext(rulesContext)}

${toneLine}

${diffLine}

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
  const hasModule = Boolean(
    (snap.adventureOutline && snap.adventureOutline.trim()) ||
      (snap.adventureChunks && snap.adventureChunks.length)
  );
  const moduleDirective = hasModule
    ? `\n\nESTA HISTORIA USA UN MÓDULO CARGADO. Abre la aventura EXACTAMENTE donde el módulo empieza:\n- Usa la ubicación, hora, clima y gancho iniciales tal como aparecen en el ESQUEMA OFICIAL y los FRAGMENTOS RELEVANTES del módulo.\n- Respeta los nombres de NPCs, lugares y eventos del módulo.\n- Integra a los personajes jugadores (${names || "los aventureros"}) dentro de esa escena inicial sin alterar los hechos del módulo.\n- Si el módulo asume un vínculo entre los personajes, respétalo; si no, invéntalo mínimo y coherente.\n- No adelantes información que el módulo revele más adelante.`
    : `\n\nSi la SEMILLA DE AVENTURA existe, respétala como premisa. Si es vaga o falta, invéntala coherente con los personajes y el tono.`;

  const user = `Inicia la historia AHORA con una escena de apertura cinematográfica. Responde con el formato obligatorio (narrativa + acciones).

Tu apertura DEBE cubrir, en este orden:
1. DÓNDE y CUÁNDO: ubicación concreta, hora del día, clima, atmósfera sensorial.
2. QUIÉNES: presenta a los jugadores por nombre e integra quién es cada uno en la escena inicial (${names || "los aventureros"}).
3. POR QUÉ están juntos: el vínculo o contrato que los une en este momento.
4. QUÉ está pasando: el gancho — un conflicto, rumor, encargo o peligro que acaba de irrumpir.
5. CÓMO pueden actuar: una invitación clara a actuar dirigida a al menos dos jugadores por nombre (preguntas concretas, no genéricas).${moduleDirective}`;

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
  const diff = difficultyGuide(snap.difficulty);
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

${diff.directive}\n(Dificultad seleccionada: ${diff.label})

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
