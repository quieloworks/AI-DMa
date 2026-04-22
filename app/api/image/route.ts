import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/server/providers/image";
import { serverT } from "@/lib/i18n/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    prompt: string;
    title?: string;
    tags?: string[];
    size?: "512x512" | "1024x1024" | "1024x1536" | "1536x1024" | "1792x1024";
    style?: "vivid" | "natural";
    cacheKey?: string;
    force?: boolean;
  };
  if (!body.prompt) return NextResponse.json({ error: serverT("errors.promptRequired") }, { status: 400 });
  try {
    const result = await generateImage({
      prompt: body.prompt,
      title: body.title,
      tags: body.tags,
      size: body.size,
      style: body.style,
      cacheKey: body.cacheKey,
      force: body.force,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
