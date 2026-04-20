import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import { NewStoryForm } from "./form";

export const dynamic = "force-dynamic";

export default function NewStoryPage() {
  const characters = getDb()
    .prepare<[], { id: string; name: string; class: string | null; race: string | null; level: number }>(
      "SELECT id, name, class, race, level FROM character ORDER BY updated_at DESC"
    )
    .all();

  return (
    <Shell active="story">
      <div className="mb-8">
        <span className="badge mb-4">Nueva aventura</span>
        <h1 className="mb-2">Comienza una historia.</h1>
        <p className="max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
          Escribe una semilla o sube un PDF con la aventura. Selecciona a tus personajes, decide el modo y comparte el QR para que tus amigos se unan.
        </p>
      </div>
      <NewStoryForm characters={characters} />
    </Shell>
  );
}
