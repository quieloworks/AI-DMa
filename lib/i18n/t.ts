import type { AppLocale } from "./locale";
import { dictionaryEn } from "./dictionaries/en";
import { dictionaryEs } from "./dictionaries/es";

const dicts: Record<AppLocale, Record<string, string>> = {
  es: dictionaryEs,
  en: dictionaryEn,
};

/** Dot-path lookup, e.g. `shell.nav.home` */
export function t(locale: AppLocale, path: string, vars?: Record<string, string | number>): string {
  const table = dicts[locale] ?? dicts.es;
  let out = table[path] ?? dicts.es[path] ?? path;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{{${k}}}`, String(v));
    }
  }
  return out;
}

export function hasKey(locale: AppLocale, path: string): boolean {
  const table = dicts[locale] ?? dicts.es;
  return path in table;
}
