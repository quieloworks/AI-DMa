import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import { CharacterSchema } from "@/lib/character";
import { EditCharacterForm } from "./form";

export const dynamic = "force-dynamic";

export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare<string, { id: string; data_json: string }>("SELECT id, data_json FROM character WHERE id = ?")
    .get(id);
  if (!row) notFound();

  const parsed = CharacterSchema.safeParse({ ...JSON.parse(row.data_json), id });
  if (!parsed.success) {
    return (
      <Shell active="character">
        <p>La hoja está corrupta y no se puede editar.</p>
      </Shell>
    );
  }

  return (
    <Shell active="character">
      <div className="mb-8">
        <span className="badge mb-4">Editar personaje</span>
        <h1 className="mb-2">{parsed.data.name}</h1>
        <p className="max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
          Ajusta los valores manualmente. Todos los cambios se guardan en la misma hoja.
        </p>
      </div>
      <EditCharacterForm character={parsed.data} />
    </Shell>
  );
}
