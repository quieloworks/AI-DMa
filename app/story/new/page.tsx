import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import { serverT } from "@/lib/i18n/server";
import { NewStoryForm } from "./form";

export const dynamic = "force-dynamic";

export default function NewStoryPage() {
  const tr = serverT;
  const characters = getDb()
    .prepare<[], { id: string; name: string; class: string | null; race: string | null; level: number }>(
      "SELECT id, name, class, race, level FROM character ORDER BY updated_at DESC"
    )
    .all();

  return (
    <Shell active="story">
      <div className="mb-8">
        <span className="badge mb-4">{tr("storyNew.badge")}</span>
        <h1 className="mb-2">{tr("storyNew.h1")}</h1>
        <p className="max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
          {tr("storyNew.lead")}
        </p>
      </div>
      <NewStoryForm characters={characters} />
    </Shell>
  );
}
