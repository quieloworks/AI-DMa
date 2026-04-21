export type DmRagBudget = {
  rulesK: number;
  adventureK: number;
  rulesChunkChars: number;
  adventureChunkChars: number;
};

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Presupuesto RAG y truncado de chunks para el prompt del DM.
 * - DM_PROMPT_BUDGET=default (por defecto): mismo comportamiento histórico (5/6 chunks, 900/1200 chars).
 * - DM_PROMPT_BUDGET=savings: valores más agresivos (4/4, 600/800) salvo override por variable.
 * Overrides: DM_RAG_RULES_K, DM_RAG_ADVENTURE_K, DM_RAG_RULES_CHAR_CAP, DM_RAG_ADVENTURE_CHAR_CAP.
 */
export function getDmRagBudget(): DmRagBudget {
  const profile = (process.env.DM_PROMPT_BUDGET ?? "default").trim().toLowerCase();
  const savings = profile === "savings" || profile === "save";

  return {
    rulesK: numEnv("DM_RAG_RULES_K", savings ? 4 : 5),
    adventureK: numEnv("DM_RAG_ADVENTURE_K", savings ? 4 : 6),
    rulesChunkChars: numEnv("DM_RAG_RULES_CHAR_CAP", savings ? 600 : 900),
    adventureChunkChars: numEnv("DM_RAG_ADVENTURE_CHAR_CAP", savings ? 800 : 1200),
  };
}
