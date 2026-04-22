import type { Feat } from "@/lib/feats";
import { FEAT_UI_EN } from "./overlays/en/feats-ui";
import type { AppLocale } from "./locale";
import { normalizeLocale } from "./locale";
import { translateGameUiString } from "./mappings/es-to-en-phrases";

function phraseForLocale(text: string, locale: AppLocale | undefined): string {
  const l = normalizeLocale(locale);
  if (l === "es") return text;
  return translateGameUiString(text);
}

/** Resolved feat text for UI/PDF — Spanish source unchanged in `Feat`; English uses overlay + phrase fallbacks. */
export function featForLocale(feat: Feat, locale: AppLocale | undefined): Feat {
  const l = normalizeLocale(locale);
  if (l === "es") return feat;
  const ui = FEAT_UI_EN[feat.id];
  if (ui) {
    return {
      ...feat,
      name: ui.name,
      summary: ui.summary,
      grants: ui.grants,
      prerequisite:
        feat.prerequisite == null
          ? undefined
          : ui.prerequisite !== undefined
            ? ui.prerequisite
            : phraseForLocale(feat.prerequisite, locale),
    };
  }
  return {
    ...feat,
    name: phraseForLocale(feat.name, locale),
    summary: phraseForLocale(feat.summary, locale),
    grants: feat.grants.map((g) => phraseForLocale(g, locale)),
    prerequisite: feat.prerequisite ? phraseForLocale(feat.prerequisite, locale) : undefined,
  };
}
