import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getDb } from "@/lib/db";
import { getLanBaseUrl } from "@/server/network";

export const runtime = "nodejs";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const row = db.prepare<string, { id: string }>("SELECT id FROM session WHERE id = ?").get(id);
  if (!row) return NextResponse.json({ error: "Sesión no existe" }, { status: 404 });

  const port = Number(process.env.PORT ?? 3000);
  const base = getLanBaseUrl(port);
  const url = `${base}/play/${id}`;

  const format = req.nextUrl.searchParams.get("format") ?? "json";
  if (format === "png") {
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "M", margin: 2, scale: 8, color: { dark: "#0f0e0c", light: "#faf7f1" } });
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
  }
  const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, scale: 8 });
  return NextResponse.json({ url, dataUrl });
}
