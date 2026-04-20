import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chunkPages } from "../server/rules/chunker";
import { clearHandbook, insertChunksWithEmbeddings, handbookStats } from "../server/rag";
import { setMeta, getMeta } from "../lib/db";

const HANDBOOK_DEFAULT = resolve(process.cwd(), "docs/D&D 5E - Player's Handbook.pdf");

async function extractPages(pdfPath: string): Promise<{ page: number; text: string }[]> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(readFileSync(pdfPath));
  const loadingTask = getDocument({ data, disableFontFace: true, isEvalSupported: false, useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pages: { page: number; text: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: unknown) => {
        const item = it as { str?: string; hasEOL?: boolean };
        return (item.str ?? "") + (item.hasEOL ? "\n" : " ");
      })
      .join("");
    pages.push({ page: i, text });
    if (i % 25 === 0) process.stdout.write(`\r  Extrayendo páginas: ${i}/${pdf.numPages}`);
  }
  process.stdout.write(`\r  Extrayendo páginas: ${pdf.numPages}/${pdf.numPages}\n`);
  return pages;
}

async function main() {
  const pdfPath = process.argv[2] ?? HANDBOOK_DEFAULT;
  if (!existsSync(pdfPath)) {
    console.error(`No encontré el PDF en: ${pdfPath}`);
    process.exit(1);
  }
  console.log(`\n  Ingestando: ${pdfPath}\n`);

  const cacheDir = resolve(process.cwd(), "data/cache");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(cacheDir, { recursive: true });
  const cachePath = join(cacheDir, "handbook-pages.json");

  let pages: { page: number; text: string }[];
  if (existsSync(cachePath)) {
    console.log("  Usando páginas en caché.");
    pages = JSON.parse(readFileSync(cachePath, "utf8"));
  } else {
    pages = await extractPages(pdfPath);
    writeFileSync(cachePath, JSON.stringify(pages));
  }

  console.log(`  Páginas extraídas: ${pages.length}`);
  const chunks = chunkPages(pages);
  console.log(`  Chunks generados:  ${chunks.length}`);

  console.log("  Limpiando tablas previas...");
  clearHandbook();

  const start = Date.now();
  await insertChunksWithEmbeddings(chunks, (done, total) => {
    const pct = ((done / total) * 100).toFixed(1);
    const secs = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r  Insertando + embeddings: ${done}/${total} (${pct}%) · ${secs}s`);
  });
  process.stdout.write("\n");

  setMeta("handbook_ingested_at", new Date().toISOString());
  const stats = handbookStats();
  console.log("\n  Listo.");
  console.log(`  Total chunks: ${stats.total}`);
  console.log(`  Embeddings:   ${stats.vecCount}`);
  console.log(`  Por sección:`);
  for (const s of stats.bySection) console.log(`    - ${s.section}: ${s.c}`);
  console.log(`  Última ingesta: ${getMeta("handbook_ingested_at")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
