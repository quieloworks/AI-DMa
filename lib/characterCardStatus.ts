/** Campos de juego mínimos leídos de `character.data_json` para la tarjeta del baúl. */
export type CharacterCardPlayStatus = {
  hpCurrent: number | null;
  hpMax: number | null;
  hpTemp: number | null;
  ac: number | null;
  portraitFromData: string | null;
};

export function parseCharacterCardPlayStatus(dataJson: string): CharacterCardPlayStatus {
  try {
    const d = JSON.parse(dataJson) as Record<string, unknown>;
    const hp = d.hp as Record<string, unknown> | undefined;
    const portraitFromData = typeof d.portrait === "string" && d.portrait.length > 0 ? d.portrait : null;
    return {
      hpCurrent: typeof hp?.current === "number" ? hp.current : null,
      hpMax: typeof hp?.max === "number" ? hp.max : null,
      hpTemp: typeof hp?.temp === "number" ? hp.temp : null,
      ac: typeof d.ac === "number" ? d.ac : null,
      portraitFromData,
    };
  } catch {
    return { hpCurrent: null, hpMax: null, hpTemp: null, ac: null, portraitFromData: null };
  }
}
