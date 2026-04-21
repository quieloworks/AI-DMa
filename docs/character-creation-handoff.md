# Character creation — Handoff

> **RAW:** `docs/D&D 5E - Player's Handbook.pdf` · Texto buscable: `data/cache/handbook-pages.json` · `npm run ingest:handbook`

---

## Pendiente (orden sugerido)

1. **`asiChoices` en schema** (opcional) — persistir en `CharacterSchema` las elecciones del paso “Mejoras” si hace falta fuera del wizard.
2. **PG rolados** (opcional) — alternativa a media en subida de nivel / creación.
3. **Conjuros** — ampliar filas en `SPELLS` (`lib/spells.ts`) si la campaña pide más nombres del PHB.
4. **Personajes antiguos (clérigo/druida/paladín)** — creados antes del repertorio completo: la ficha puede tener pocos conjuros en `known`; el panel de preparación sólo actúa sobre esa lista (regenerar personaje o ampliar en edición si hace falta el listado PHB completo).

---

## Referencia de archivos

| Área | Archivo |
| --- | --- |
| Personaje / CA / clases | `lib/character.ts` (`computeAc` incluye `otherAcBonus`; `acOtherBonus` en schema) |
| Conjuros | `lib/spells.ts` |
| Herramientas PHB | `lib/tools.ts` |
| Pasivas / estilos (no CA) | `lib/rules-engine.ts` |
| Wizard | `app/character/new/wizard.tsx` |
| Preparación diaria en hoja | `app/character/[id]/SpellDailyPrep.tsx` |
| Edición | `app/character/[id]/edit/form.tsx` |

---

## Verificación

```bash
npx tsc --noEmit && npm run dev
```

---

## Historial

- **2026-04-21 (V)**: **Lanzadores preparados (PHB cap. 10)**: al guardar desde el wizard, `buildKnownSpells` incluye **todo el repertorio** de clase (conjuros de nv. ≥1 hasta el máximo lanzable) con `prepared` sólo en los elegidos; texto del paso Conjuros actualizado. **Hoja**: `SpellDailyPrep` (client) para cambiar preparados tras descanso largo, con tope `nivel + mod` (vía `nonCantripSpellPicks`). **CA y objetos mágicos**: `computeAc(..., otherAcBonus)`; campo `acOtherBonus` en schema; wizard y edición lo persisten; la CA total en juego sigue siendo `ac` (editable en edición) con nota si `acOtherBonus` ≠ 0.
- **2026-04-21 (IV)**: `lib/tools.ts` + paso Habilidades + `lib/rules-engine.ts` + aclaración catálogo conjuros nv 3–9.
- **2026-04-21 (III–I)**: Conjuros nv 2+, grimorio, estilos, HP multi-nivel, etc.

_Actualizar solo “Pendiente” e “Historial” al cerrar trabajo._
