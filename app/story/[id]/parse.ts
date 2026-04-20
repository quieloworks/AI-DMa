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
