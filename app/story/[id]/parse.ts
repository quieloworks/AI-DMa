/** Texto visible en la crónica mientras llega el stream (solo <narrativa>, sin <acciones>). */
export function streamingNarrativePreview(raw: string): string {
  const lower = raw.toLowerCase();
  const openTag = "<narrativa>";
  const openIdx = lower.indexOf(openTag);
  if (openIdx === -1) return "";
  const start = openIdx + openTag.length;
  const after = raw.slice(start);
  const closeLower = "</narrativa>";
  const closeIdx = after.toLowerCase().indexOf(closeLower);
  const inner = closeIdx === -1 ? after : after.slice(0, closeIdx);
  return inner.replace(/\[emocion:[^\]]+\]/gi, "").trimEnd();
}

export function parseDmResponse(raw: string): { narrative: string; actions: Record<string, unknown>; emotion?: string } {
  const narrativa = /<narrativa>([\s\S]*?)<\/narrativa>/i.exec(raw)?.[1]?.trim() ?? raw;
  const acciones = /<acciones>([\s\S]*?)<\/acciones>/i.exec(raw)?.[1]?.trim() ?? "{}";
  const emotion = /\[emocion:([^\]]+)\]/i.exec(narrativa)?.[1]?.trim();
  let actions: Record<string, unknown> = {};
  try {
    actions = JSON.parse(acciones);
  } catch {
    try {
      actions = JSON.parse(acciones.replace(/,\s*([}\]])/g, "$1"));
    } catch {
      actions = {};
    }
  }
  return { narrative: narrativa, actions, emotion };
}
