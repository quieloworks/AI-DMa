import { getSetting } from "@/lib/db";
import type { AppLocale } from "./locale";
import { GLOBAL_SETTINGS_DEFAULTS, mergeGlobalSettings, type GlobalSettings } from "./global-settings";
import { t } from "./t";

export function getGlobalSettings(): GlobalSettings {
  const raw = getSetting<Partial<GlobalSettings>>("global", GLOBAL_SETTINGS_DEFAULTS);
  return mergeGlobalSettings(raw);
}

export function getLocale(): AppLocale {
  return getGlobalSettings().locale;
}

export function serverT(path: string, vars?: Record<string, string | number>): string {
  return t(getLocale(), path, vars);
}
