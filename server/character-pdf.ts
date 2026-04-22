import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  ABILITIES,
  BACKGROUNDS,
  CLASSES,
  RACES,
  SKILLS,
  abilityMod,
  effectiveAbility,
  initiative,
  proficiencyBonus,
  savingThrow,
  skillBonus,
  type Character,
} from "@/lib/character";
import { findSpellByName } from "@/lib/spells";
import type { AppLocale } from "@/lib/i18n/locale";
import { normalizeLocale } from "@/lib/i18n/locale";
import { t } from "@/lib/i18n/t";
import {
  localizeGamePhrase,
  localizedAbilityLabel,
  localizedBackgroundBasics,
  localizedClassBasics,
  localizedRaceBasics,
  localizedRaceVariant,
  localizedSkillLabel,
} from "@/lib/i18n/game-localize";
import { displayLanguageName } from "@/lib/i18n/language-names";
import { spellForLocale } from "@/lib/i18n/spell-i18n";

const ALIGNMENT_CODES = ["LG", "NG", "CG", "LN", "N", "CN", "LE", "NE", "CE"] as const;

function alignmentLabel(character: Character, locale: AppLocale): string {
  const a = character.alignment ?? "";
  if ((ALIGNMENT_CODES as readonly string[]).includes(a)) return t(locale, `wizard.alignment.${a}`);
  return a;
}

function raceDisplay(character: Character, locale: AppLocale): string {
  const r = RACES.find((x) => x.id === character.race);
  if (!r) return character.race;
  const rb = localizedRaceBasics(r, locale);
  if (character.subrace && r.variants) {
    const v = r.variants.find((x) => x.id === character.subrace);
    if (v) return `${rb.label} (${localizedRaceVariant(v, r.id, locale).label})`;
  }
  return rb.label;
}

function classDisplay(character: Character, locale: AppLocale): string {
  const c = CLASSES.find((x) => x.id === character.class);
  return c ? localizedClassBasics(c, locale).label : character.class;
}

function backgroundDisplay(character: Character, locale: AppLocale): string {
  const b = BACKGROUNDS.find((x) => x.id === character.background);
  return b ? localizedBackgroundBasics(b, locale).label : character.background;
}

export async function buildCharacterSheetPdf(character: Character, locale?: AppLocale | string): Promise<Uint8Array> {
  const loc = normalizeLocale(locale);
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const ink = rgb(0.08, 0.07, 0.05);
  const soft = rgb(0.35, 0.32, 0.28);
  const accent = rgb(0.6, 0.24, 0.11);

  const drawText = (text: string, x: number, y: number, size = 10, f = font, color = ink) =>
    page.drawText(text ?? "", { x, y, size, font: f, color });

  const drawLine = (x1: number, y1: number, x2: number, y2: number, op = 0.2) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: ink, opacity: op });

  const drawBox = (x: number, y: number, w: number, h: number) =>
    page.drawRectangle({ x, y, width: w, height: h, borderColor: ink, borderWidth: 0.5, borderOpacity: 0.25 });

  const raceStr = raceDisplay(character, loc);
  const classStr = classDisplay(character, loc);
  const bgStr = backgroundDisplay(character, loc);
  const alignStr = alignmentLabel(character, loc);

  drawText(t(loc, "pdf.sheet.title"), 40, 755, 9, bold, soft);
  drawText(character.name || "—", 40, 725, 26, bold);
  drawText(`${raceStr.toUpperCase()} · ${classStr.toUpperCase()} · ${t(loc, "pdf.sheet.levelAbbr")} ${character.level}`, 40, 708, 9, font, soft);
  drawText(`${t(loc, "pdf.sheet.background")}: ${bgStr}   ${t(loc, "pdf.sheet.alignment")}: ${alignStr}`, 40, 693, 9, italic, soft);

  drawLine(40, 680, 572, 680);

  const abilityX = 40;
  const abilityY = 620;
  ABILITIES.forEach((a, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = abilityX + col * 180;
    const y = abilityY - row * 60;
    drawBox(x, y - 4, 170, 54);
    drawText(localizedAbilityLabel(a, loc).toUpperCase(), x + 10, y + 32, 8, bold, soft);
    const score = effectiveAbility(character, a);
    drawText(String(score), x + 10, y + 8, 26, bold);
    drawText(formatMod(abilityMod(score)), x + 128, y + 16, 14, bold, accent);
    drawText(t(loc, "pdf.sheet.modAbbr"), x + 134, y + 6, 7, font, soft);
  });

  const coreY = 490;
  drawBox(40, coreY - 4, 170, 54);
  drawText(t(loc, "pdf.sheet.hp"), 50, coreY + 32, 8, bold, soft);
  drawText(`${character.hp.current}/${character.hp.max}`, 50, coreY + 8, 22, bold);
  if (character.hp.temp) drawText(`+${character.hp.temp} ${t(loc, "pdf.sheet.tempHp")}`, 140, coreY + 10, 9, italic, soft);

  drawBox(220, coreY - 4, 90, 54);
  drawText(t(loc, "pdf.sheet.ac"), 230, coreY + 32, 8, bold, soft);
  drawText(String(character.ac), 230, coreY + 8, 22, bold);

  drawBox(320, coreY - 4, 90, 54);
  drawText(t(loc, "pdf.sheet.initiative"), 330, coreY + 32, 8, bold, soft);
  drawText(formatMod(initiative(character)), 330, coreY + 8, 22, bold);

  drawBox(420, coreY - 4, 90, 54);
  drawText(t(loc, "pdf.sheet.speed"), 430, coreY + 32, 8, bold, soft);
  drawText(`${character.speed} ft`, 430, coreY + 8, 18, bold);

  drawText(
    `${t(loc, "pdf.sheet.profBonusLine", { n: proficiencyBonus(character.level) })}   ·   ${t(loc, "pdf.sheet.hitDieLine", { n: character.hp.hitDie })}`,
    40,
    coreY - 20,
    9,
    italic,
    soft,
  );

  const stY = 440;
  drawText(t(loc, "pdf.sheet.saves"), 40, stY, 9, bold, accent);
  drawLine(40, stY - 4, 220, stY - 4);
  ABILITIES.forEach((a, i) => {
    const y = stY - 16 - i * 13;
    const prof = character.savingThrows.includes(a);
    drawText(prof ? "[x]" : "[ ]", 42, y, 9, font, prof ? accent : soft);
    drawText(localizedAbilityLabel(a, loc), 66, y, 9);
    drawText(formatMod(savingThrow(character, a)), 190, y, 9, bold);
  });

  const skY = 440;
  drawText(t(loc, "pdf.sheet.skills"), 250, skY, 9, bold, accent);
  drawLine(250, skY - 4, 572, skY - 4);
  const entries = Object.entries(SKILLS);
  entries.forEach(([key, _s], i) => {
    const col = Math.floor(i / 9);
    const row = i % 9;
    const x = 252 + col * 165;
    const y = skY - 16 - row * 13;
    const prof = character.skills.includes(key);
    drawText(prof ? "[x]" : "[ ]", x, y, 9, font, prof ? accent : soft);
    drawText(localizedSkillLabel(key, loc), x + 22, y, 9);
    drawText(formatMod(skillBonus(character, key)), x + 148, y, 9, bold);
  });

  const eqY = 310;
  drawText(t(loc, "pdf.sheet.equipment"), 40, eqY, 9, bold, accent);
  drawLine(40, eqY - 4, 310, eqY - 4);
  character.equipment.slice(0, 18).forEach((it, i) => {
    const nm = localizeGamePhrase(it.name, loc);
    drawText(`- ${it.qty > 1 ? it.qty + " x " : ""}${nm}`, 42, eqY - 16 - i * 12, 9);
  });

  drawText(t(loc, "pdf.sheet.coins"), 40, 120, 9, bold, accent);
  drawLine(40, 116, 310, 116);
  const money = character.money;
  drawText(
    `${t(loc, "pdf.sheet.cp")} ${money.cp}   ·   ${t(loc, "pdf.sheet.sp")} ${money.sp}   ·   ${t(loc, "pdf.sheet.ep")} ${money.ep}   ·   ${t(loc, "pdf.sheet.gp")} ${money.gp}   ·   ${t(loc, "pdf.sheet.pp")} ${money.pp}`,
    42,
    100,
    9,
  );

  const rY = 310;
  drawText(t(loc, "pdf.sheet.featuresFeats"), 330, rY, 9, bold, accent);
  drawLine(330, rY - 4, 572, rY - 4);
  character.features.slice(0, 6).forEach((f, i) => {
    drawText(`- ${localizeGamePhrase(f.name, loc)}`, 332, rY - 16 - i * 26, 9, bold);
    drawText(localizeGamePhrase(f.text, loc).slice(0, 80), 332, rY - 28 - i * 26, 8, italic, soft);
  });

  drawText(t(loc, "pdf.sheet.profLang"), 330, 180, 9, bold, accent);
  drawLine(330, 176, 572, 176);
  const profs = [
    ...(character.proficiencies.armor ?? []),
    ...(character.proficiencies.weapons ?? []),
    ...(character.proficiencies.tools ?? []),
  ].map((p) => localizeGamePhrase(p, loc));
  const langs = (character.proficiencies.languages ?? []).map((l) => displayLanguageName(l, loc));
  drawText(`${t(loc, "pdf.sheet.profsPrefix")} ${profs.join(", ").slice(0, 300) || "—"}`, 332, 160, 8, italic, soft);
  drawText(`${t(loc, "pdf.sheet.langsPrefix")} ${langs.join(", ") || "—"}`, 332, 140, 8, italic, soft);

  if (character.spells?.known && character.spells.known.length > 0) {
    const page2 = doc.addPage([612, 792]);
    page2.drawText(t(loc, "pdf.sheet.spellsTitle"), { x: 40, y: 755, size: 12, font: bold, color: accent });
    const slots = character.spells.slots ?? {};
    let yCursor = 730;
    Object.entries(slots).forEach(([lvl, s]) => {
      page2.drawText(t(loc, "pdf.sheet.spellSlotRow", { lvl, used: s.max - s.used, max: s.max }), {
        x: 40,
        y: yCursor,
        size: 10,
        font,
      });
      yCursor -= 14;
    });
    yCursor -= 10;
    character.spells.known.forEach((sp) => {
      const cat = findSpellByName(sp.name);
      const nm = cat ? spellForLocale(cat, loc).name : localizeGamePhrase(sp.name, loc);
      const prep = sp.prepared ? `  ${t(loc, "pdf.sheet.spellPrepared")}` : "";
      page2.drawText(`- [${sp.level}] ${nm}${prep}`, { x: 40, y: yCursor, size: 10, font });
      yCursor -= 13;
      if (yCursor < 60) return;
    });
  }

  return doc.save();
}

function formatMod(n: number) {
  return n >= 0 ? `+${n}` : String(n);
}
