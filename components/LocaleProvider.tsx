"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useCallback } from "react";
import type { AppLocale } from "@/lib/i18n/locale";
import { normalizeLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";

type LocaleCtx = {
  locale: AppLocale;
  t: (path: string, vars?: Record<string, string | number>) => string;
};

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ locale, children }: { locale: AppLocale; children: ReactNode }) {
  const value = useMemo(
    () => ({
      locale,
      t: (path: string, vars?: Record<string, string | number>) => t(locale, path, vars),
    }),
    [locale],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocaleContext(): LocaleCtx | null {
  return useContext(Ctx);
}

export function useTranslations(): LocaleCtx["t"] {
  const ctx = useContext(Ctx);
  const locale = ctx?.locale ?? "es";
  return useCallback((path: string, vars?: Record<string, string | number>) => t(locale, path, vars), [locale]);
}

export function useLocale(): AppLocale {
  const ctx = useContext(Ctx);
  return ctx ? normalizeLocale(ctx.locale) : "es";
}
