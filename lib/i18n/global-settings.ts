import type { AppLocale } from "./locale";
import { normalizeLocale } from "./locale";

export type GlobalSettings = {
  diceDm: "auto" | "manual";
  diceDefault: "auto" | "manual";
  voice: string;
  sfx: boolean;
  defaultMode: "auto" | "assistant";
  locale: AppLocale;
};

export const GLOBAL_SETTINGS_DEFAULTS: GlobalSettings = {
  diceDm: "auto",
  diceDefault: "auto",
  voice: "Paulina",
  sfx: true,
  defaultMode: "auto",
  locale: "es",
};

export function mergeGlobalSettings(raw: Partial<GlobalSettings> | Record<string, unknown> | null | undefined): GlobalSettings {
  const o = raw && typeof raw === "object" ? raw : {};
  return {
    ...GLOBAL_SETTINGS_DEFAULTS,
    ...o,
    locale: normalizeLocale((o as GlobalSettings).locale),
  };
}
