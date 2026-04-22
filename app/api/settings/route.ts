import { NextRequest, NextResponse } from "next/server";
import { setSetting, getSetting } from "@/lib/db";
import { GLOBAL_SETTINGS_DEFAULTS, mergeGlobalSettings } from "@/lib/i18n/global-settings";

export const runtime = "nodejs";

export async function GET() {
  const raw = getSetting<Partial<typeof GLOBAL_SETTINGS_DEFAULTS>>("global", GLOBAL_SETTINGS_DEFAULTS);
  return NextResponse.json(mergeGlobalSettings(raw));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  setSetting("global", body);
  return NextResponse.json({ ok: true });
}
