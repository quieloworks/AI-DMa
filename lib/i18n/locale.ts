export type AppLocale = "es" | "en";

export function normalizeLocale(raw: unknown): AppLocale {
  if (raw === "en") return "en";
  return "es";
}

export function localeCompareCollator(locale: AppLocale): string {
  return locale === "en" ? "en" : "es";
}
