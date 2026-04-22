import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { buildCharacterSheetPdf } from "@/server/character-pdf";
import { CharacterSchema } from "@/lib/character";
import { getGlobalSettings } from "@/lib/i18n/server";
import { normalizeLocale } from "@/lib/i18n/locale";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = getDb()
    .prepare<string, { data_json: string; name: string }>("SELECT data_json, name FROM character WHERE id = ?")
    .get(id);
  if (!row) return new Response("Not found", { status: 404 });
  const data = JSON.parse(row.data_json);
  const parsed = CharacterSchema.safeParse({ ...data, id });
  if (!parsed.success) return new Response(`Character data inválida: ${parsed.error.message}`, { status: 400 });

  const locale = normalizeLocale(req.nextUrl.searchParams.get("locale") ?? getGlobalSettings().locale);
  const pdf = await buildCharacterSheetPdf(parsed.data, locale);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${(row.name || "personaje").replace(/[^\w\s-]/g, "")}.pdf"`,
    },
  });
}
