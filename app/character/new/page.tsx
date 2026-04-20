import { Shell } from "@/components/Shell";
import { CharacterWizard } from "./wizard";

export const dynamic = "force-dynamic";

export default function NewCharacterPage() {
  return (
    <Shell active="character">
      <div className="mb-8">
        <span className="badge mb-4">Creación de personaje</span>
        <h1 className="mb-2">Un nuevo héroe se forja.</h1>
        <p className="max-w-2xl" style={{ color: "var(--color-text-secondary)" }}>
          Elige raza, clase y trasfondo. La aplicación calcula tus modificadores, puntos de vida, defensa y competencias según las reglas del Manual del Jugador 5E.
        </p>
      </div>
      <CharacterWizard />
    </Shell>
  );
}
