import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/Shell";
import { getDb } from "@/lib/db";
import {
  ABILITIES,
  BACKGROUNDS,
  CLASSES,
  RACES,
  SKILLS,
  abilityMod,
  CharacterSchema,
  effectiveAbility,
  effectiveSpellKnownForCharacter,
  initiative,
  proficiencyBonus,
  savingThrow,
  skillBonus,
  type Character,
} from "@/lib/character";
import { findFeat } from "@/lib/feats";
import { SpellDailyPrep } from "./SpellDailyPrep";
import { getGlobalSettings } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/t";
import {
  featForLocale,
  localizeGamePhrase,
  localizedAbilityLabel,
  localizedBackgroundBasics,
  localizedClassBasics,
  localizedRaceBasics,
  localizedRaceVariant,
  localizedSkillLabel,
} from "@/lib/i18n/game-localize";
import { spellForLocale } from "@/lib/i18n/spell-i18n";
import { findSpellByName } from "@/lib/spells";
import type { AppLocale } from "@/lib/i18n/locale";

export const dynamic = "force-dynamic";

function lineageSubtitle(
  ch: Character,
  locale: AppLocale,
  tr: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const race = RACES.find((r) => r.id === ch.race);
  let raceDisp = ch.race;
  if (race) {
    const rb = localizedRaceBasics(race, locale);
    if (ch.subrace && race.variants) {
      const v = race.variants.find((x) => x.id === ch.subrace);
      raceDisp = v ? `${rb.label} (${localizedRaceVariant(v, race.id, locale).label})` : rb.label;
    } else {
      raceDisp = rb.label;
    }
  }
  const klass = CLASSES.find((c) => c.id === ch.class);
  const classDisp = klass ? localizedClassBasics(klass, locale).label : ch.class;
  const bg = BACKGROUNDS.find((b) => b.id === ch.background);
  const bgDisp = bg ? localizedBackgroundBasics(bg, locale).label : ch.background;
  return `${raceDisp} · ${classDisp} ${tr("characterSheet.levelWord")} ${ch.level} · ${bgDisp}`;
}

export default async function CharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = getDb()
    .prepare<string, { id: string; name: string; level: number; class: string | null; race: string | null; data_json: string }>(
      "SELECT id, name, level, class, race, data_json FROM character WHERE id = ?"
    )
    .get(id);
  if (!row) notFound();

  const locale = getGlobalSettings().locale;
  const tr = (key: string, vars?: Record<string, string | number>) => t(locale, key, vars);

  const parsed = CharacterSchema.safeParse({ ...JSON.parse(row.data_json), id });
  if (!parsed.success)
    return (
      <Shell active="character">
        <p>{tr("characterSheet.invalid")}</p>
      </Shell>
    );
  const ch = parsed.data;
  const spellRows = effectiveSpellKnownForCharacter(ch);

  return (
    <Shell active="character">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <span className="badge mb-3">{tr("characterSheet.badge")}</span>
          <h1>{ch.name}</h1>
          {ch.playerName && (
            <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
              {tr("characterSheet.player")} {ch.playerName}
            </p>
          )}
          <p className="mt-1" style={{ color: "var(--color-text-secondary)" }}>
            {lineageSubtitle(ch, locale, tr)}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/api/character/${ch.id}/pdf?locale=${locale}`} className="btn-ghost" prefetch={false}>
            {tr("characterSheet.exportPdf")}
          </Link>
          <Link href={`/character/${ch.id}/edit`} className="btn-ghost">
            {tr("characterSheet.edit")}
          </Link>
          <Link href="/character/new" className="btn-accent">
            {tr("characterSheet.new")}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr_1fr]">
        <div className="card">
          <p className="label mb-3">{tr("characterSheet.attributes")}</p>
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
          <p className="label mb-2">{tr("characterSheet.saves")}</p>
          <ul className="space-y-1 text-sm">
            {ABILITIES.map((a) => (
              <li key={a} className="flex justify-between">
                <span>
                  {ch.savingThrows.includes(a) ? "●" : "○"} {localizedAbilityLabel(a, locale)}
                </span>
                <span style={{ fontFamily: "var(--font-display)" }}>{fmt(savingThrow(ch, a))}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <p className="label mb-3">Vitales</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Stat label="HP" value={`${ch.hp.current}/${ch.hp.max}`} />
              {ch.hp.levelUpRolls && ch.hp.levelUpRolls.length > 0 && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                  PG por tiradas (niv. 2+): {ch.hp.levelUpRolls.join(", ")} (d{ch.hp.hitDie})
                </p>
              )}
            </div>
            <div>
              <Stat label="CA" value={ch.ac} />
              {(ch.acOtherBonus ?? 0) !== 0 && (
                <p className="mt-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                  Anotado +{ch.acOtherBonus} por objetos mágicos (PHB).
                </p>
              )}
            </div>
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
                  {ch.skills.includes(key) ? "●" : "○"} {localizedSkillLabel(key, locale)}
                </span>
                <span style={{ fontFamily: "var(--font-display)" }}>{fmt(skillBonus(ch, key))}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(spellRows.length > 0 || Object.keys(ch.spells.slots).length > 0) && (
        <div className="mt-6 card">
          <SpellDailyPrep character={ch} />
          <div className="mb-3 flex items-center justify-between">
            <p className="label">Conjuros</p>
            {ch.spells.ability && (
              <span className="badge">
                {tr("characterSheet.spellAbility")}: {localizedAbilityLabel(ch.spells.ability, locale)}
              </span>
            )}
          </div>
          {Object.keys(ch.spells.slots).length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2 text-sm">
              {Object.entries(ch.spells.slots)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([lvl, s]) => (
                  <span key={lvl} className="badge">
                    Nv {lvl}: {s.max - s.used}/{s.max}
                  </span>
                ))}
            </div>
          )}
          <ul className="grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
            {spellRows.map((s, i) => {
              const cat = findSpellByName(s.name);
              const dispName = cat ? spellForLocale(cat, locale).name : s.name;
              return (
                <li key={i}>
                  <span style={{ color: "var(--color-accent)" }}>
                    {s.level === 0 ? "Truco" : `Nv ${s.level}`}
                  </span>{" "}
                  · {s.prepared ? "●" : "○"} {dispName}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {ch.asiChoices.length > 0 && (
        <div className="mt-6 card">
          <p className="label mb-3">{tr("characterSheet.asiSection")}</p>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {ch.asiChoices.map((c, i) => {
              const pickedFeat = c.kind === "feat" && c.featId ? findFeat(c.featId) : undefined;
              return (
                <li key={i}>
                  {c.kind === "asi" ? (
                    <>
                      <strong>{tr("characterSheet.asiAbbr")}</strong>:{" "}
                      {c.picks.length === 1
                        ? tr("characterSheet.asiPlusTwo", { a: localizedAbilityLabel(c.picks[0]!, locale) })
                        : tr("characterSheet.asiPlusSplit", {
                            a: localizedAbilityLabel(c.picks[0]!, locale),
                            b: localizedAbilityLabel(c.picks[1]!, locale),
                          })}
                    </>
                  ) : (
                    <>
                      <strong>{tr("characterSheet.featAbbr")}</strong>:{" "}
                      {pickedFeat ? featForLocale(pickedFeat, locale).name : c.featId}
                      {c.abilityChoice && (
                        <span className="ml-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                          ({tr("characterSheet.attrChoice")}: {localizedAbilityLabel(c.abilityChoice, locale)})
                        </span>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {ch.feats.length > 0 && (
        <div className="mt-6 card">
          <p className="label mb-3">{tr("characterSheet.featsSection")}</p>
          <ul className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            {ch.feats.map((id) => {
              const feat = findFeat(id);
              if (!feat) return null;
              const fd = featForLocale(feat, locale);
              return (
                <li key={id}>
                  <p>
                    <strong>{fd.name}</strong>
                    {fd.prerequisite && (
                      <span className="ml-2 text-xs" style={{ color: "var(--color-text-hint)" }}>
                        {tr("characterSheet.req")} {fd.prerequisite}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--color-text-secondary)" }}>
                    {fd.summary}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs" style={{ color: "var(--color-text-hint)" }}>
                    {fd.grants.map((line, i) => (
                      <li key={i}>· {line}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card">
          <p className="label mb-3">Equipamiento</p>
          <ul className="space-y-1 text-sm">
            {ch.equipment.map((it, i) => (
              <li key={i}>
                · {it.qty > 1 ? it.qty + " × " : ""}
                {localizeGamePhrase(it.name, locale)}
              </li>
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
