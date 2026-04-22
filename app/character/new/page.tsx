import { Shell } from "@/components/Shell";
import { CharacterWizard } from "./wizard";
import { getGlobalSettings } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function NewCharacterPage() {
  const locale = getGlobalSettings().locale;
  const tr = (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);

  return (
    <Shell active="character">
      <div className="mb-8">
        <span className="badge mb-4">{tr("characterNew.page.badge")}</span>
        <h1 className="mb-2">{tr("characterNew.page.title")}</h1>
        <p className="max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
          {tr("characterNew.page.lead")}
        </p>
      </div>
      <CharacterWizard />
    </Shell>
  );
}
