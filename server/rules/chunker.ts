export const HANDBOOK_SECTIONS = [
  { id: "intro", label: "Introducción", patterns: [/^introducci[óo]n/i, /^introduction/i] },
  { id: "razas", label: "Razas", patterns: [/^razas?/i, /^races?/i] },
  { id: "clases", label: "Clases", patterns: [/^clases?/i, /^classes?/i] },
  { id: "trasfondos", label: "Trasfondos", patterns: [/^trasfond/i, /^antecedent/i, /^backgrounds?/i] },
  { id: "personalizacion", label: "Personalización", patterns: [/^personalizaci/i, /^customizing/i] },
  { id: "equipamiento", label: "Equipamiento", patterns: [/^equipamient/i, /^equipment/i] },
  { id: "habilidades", label: "Habilidades", patterns: [/^uso de habilidades/i, /^using ability/i, /^habilidades/i, /^abilities/i] },
  { id: "aventurar", label: "Aventurar", patterns: [/^aventurar/i, /^adventurin/i] },
  { id: "combate", label: "Combate", patterns: [/^combate/i, /^combat/i] },
  { id: "conjuros", label: "Lanzamiento de Conjuros", patterns: [/^lanzamiento de conjuros/i, /^spellcastin/i] },
  { id: "lista-conjuros", label: "Lista de Conjuros", patterns: [/^lista de conjuros/i, /^spells? list/i, /^conjuros/i, /^spells?$/i] },
  { id: "apendices", label: "Apéndices", patterns: [/^ap[eé]ndice/i, /^appendix/i] },
];

export type SectionId = (typeof HANDBOOK_SECTIONS)[number]["id"];

export type Chunk = {
  section: string;
  subsection: string | null;
  page: number;
  text: string;
  tokens: number;
};

const MAX_CHUNK = 750;
const OVERLAP = 120;

export function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export function classifySection(line: string): { section: string; label: string } | null {
  const l = line.trim();
  if (!l || l.length > 80) return null;
  for (const s of HANDBOOK_SECTIONS) {
    if (s.patterns.some((p) => p.test(l))) return { section: s.id, label: s.label };
  }
  return null;
}

export function chunkPages(pages: { page: number; text: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  let currentSection = "intro";
  let currentSubsection: string | null = null;
  let buffer: string[] = [];
  let bufferPage = pages[0]?.page ?? 1;
  let bufferTokens = 0;

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (!text) return;
    chunks.push({
      section: currentSection,
      subsection: currentSubsection,
      page: bufferPage,
      text,
      tokens: bufferTokens,
    });
    if (OVERLAP > 0 && text.length > OVERLAP * 4) {
      const tail = text.slice(-OVERLAP * 4);
      buffer = [tail];
      bufferTokens = approxTokens(tail);
    } else {
      buffer = [];
      bufferTokens = 0;
    }
  };

  for (const page of pages) {
    const lines = page.text.split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.replace(/\s+/g, " ").trim();
      if (!line) continue;

      const cls = classifySection(line);
      if (cls) {
        flush();
        currentSection = cls.section;
        currentSubsection = null;
        bufferPage = page.page;
        continue;
      }

      const isHeading = line.length < 60 && /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ,\-()]+$/.test(line) && !line.endsWith(".");
      if (isHeading) {
        if (buffer.length > 0) flush();
        currentSubsection = line;
        bufferPage = page.page;
        continue;
      }

      const t = approxTokens(line);
      if (bufferTokens + t > MAX_CHUNK) {
        flush();
        bufferPage = page.page;
      }
      buffer.push(line);
      bufferTokens += t;
    }
  }
  flush();
  return chunks.filter((c) => c.text.length > 80);
}
