import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import { ABILITIES, ABILITY_LABEL, SKILLS, abilityMod, CharacterSchema, effectiveAbility, initiative, proficiencyBonus, savingThrow, skillBonus } from "@/lib/character";

export const dynamic = "force-dynamic";

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare<string, { id: string; name: string; level: number; class: string | null; race: string | null; data_json: string }>(
      "SELECT id, name, level, class, race, data_json FROM character WHERE id = ?"
    )
    .get(id);
  if (!row) notFound();

  const parsed = CharacterSchema.safeParse({ ...JSON.parse(row.data_json), id });
  if (!parsed.success) return <Shell><p>Hoja inválida.</p></Shell>;
  const ch = parsed.data;

  return (
    <Shell active="character">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <span className="badge mb-3">Hoja de personaje</span>
          <h1>{ch.name}</h1>
          {ch.playerName && (
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
              Jugador: {ch.playerName}
            </p>
          )}
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {ch.race} · {ch.class} nivel {ch.level} · {ch.background}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/api/character/${ch.id}/pdf`} className="btn-ghost" prefetch={false}>
            Exportar PDF
          </Link>
          <Link href={`/character/${ch.id}/edit`} className="btn-ghost">
            Editar
          </Link>
          <Link href="/character/new" className="btn-accent">
            Nuevo
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="card">
          <p className="label mb-3">Atributos</p>
          <div className="grid grid-cols-3 gap-2">
            {ABILITIES.map((a) => (
              <div key={a} className="rounded-md p-2 text-center" style={{ background: "var(--color-bg-tertiary)" }}>
                <p className="label uppercase">{a}</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{effectiveAbility(ch, a)}</p>
                <p style={{ color: "var(--color-text-hint)", fontSize: 11 }}>{fmt(abilityMod(effectiveAbility(ch, a)))}</p>
              </div>
            ))}
          </div>
          <div className="my-4 divider" />
          <p className="label mb-2">Salvaciones</p>
          <ul className="space-y-1 text-sm">
            {ABILITIES.map((a) => (
              <li key={a} className="flex justify-between">
                <span>
                  {ch.savingThrows.includes(a) ? "●" : "○"} {ABILITY_LABEL[a]}
                </span>
                <span style={{ fontFamily: "var(--font-display)" }}>{fmt(savingThrow(ch, a))}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <p className="label mb-3">Vitales</p>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="HP" value={`${ch.hp.current}/${ch.hp.max}`} />
            <Stat label="CA" value={ch.ac} />
            <Stat label="Iniciativa" value={fmt(initiative(ch))} />
            <Stat label="Vel." value={`${ch.speed} ft`} />
          </div>
          <div className="my-4 divider" />
          <p className="label mb-2">Competencia</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>+{proficiencyBonus(ch.level)}</p>
          <p className="label mt-4 mb-2">Dado de golpe</p>
          <p>d{ch.hp.hitDie}</p>
        </div>

        <div className="card">
          <p className="label mb-3">Habilidades</p>
          <ul className="grid grid-cols-1 gap-1 text-sm">
            {Object.entries(SKILLS).map(([key, s]) => (
              <li key={key} className="flex items-center justify-between">
                <span style={{ color: ch.skills.includes(key) ? "var(--color-text-primary)" : "var(--color-text-hint)" }}>
                  {ch.skills.includes(key) ? "●" : "○"} {s.label}
                </span>
                <span style={{ fontFamily: "var(--font-display)" }}>{fmt(skillBonus(ch, key))}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <p className="label mb-3">Equipamiento</p>
          <ul className="space-y-1 text-sm">
            {ch.equipment.map((it, i) => (
              <li key={i}>· {it.qty > 1 ? it.qty + " × " : ""}{it.name}</li>
            ))}
          </ul>
          <div className="my-4 divider" />
          <p className="label mb-2">Monedas</p>
          <p className="text-sm">PC {ch.money.cp} · PP {ch.money.sp} · PE {ch.money.ep} · PO {ch.money.gp} · PPL {ch.money.pp}</p>
        </div>
        <div className="card">
          <p className="label mb-3">Rasgos</p>
          {ch.features.map((f, i) => (
            <div key={i} className="mb-3">
              <p className="font-medium">{f.name}</p>
              <p className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                {f.text}
              </p>
            </div>
          ))}
          <div className="my-4 divider" />
          <p className="label mb-2">Idiomas</p>
          <p className="text-sm">{ch.proficiencies.languages.join(", ") || "—"}</p>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md p-3" style={{ background: "var(--color-bg-tertiary)" }}>
      <p className="label">{label}</p>
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22 }}>{value}</p>
    </div>
  );
}

function fmt(n: number) {
  return n >= 0 ? `+${n}` : String(n);
}
