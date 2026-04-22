import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import { CharacterSchema } from "@/lib/character";
import { EditCharacterForm } from "./form";
import { getGlobalSettings } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/t";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare<string, { id: string; data_json: string }>("SELECT id, data_json FROM character WHERE id = ?")
    .get(id);
  if (!row) notFound();

  const locale = getGlobalSettings().locale;
  const tr = (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);

  const parsed = CharacterSchema.safeParse({ ...JSON.parse(row.data_json), id });
  if (!parsed.success) {
    return (
      <Shell active="character">
        <p>{tr("characterEdit.page.corrupt")}</p>
      </Shell>
    );
  }

  return (
    <Shell active="character">
      <div className="mb-8">
        <span className="badge mb-4">{tr("characterEdit.page.badge")}</span>
        <h1 className="mb-2">{parsed.data.name}</h1>
        <p className="max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
          {tr("characterEdit.page.lead")}
        </p>
      </div>
      <EditCharacterForm character={parsed.data} />
    </Shell>
  );
}
