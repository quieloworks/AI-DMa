# Character creation — Handoff

> **RAW:** `docs/D&D 5E - Player's Handbook.pdf` · Texto buscable (si existe): `data/cache/handbook-pages.json` · `npm run ingest:handbook`

---

## Pendiente

1. **Catálogo `SPELLS`** — añadir conjuros puntuales o niveles altos cuando la mesa los pida; no hace falta duplicar el PHB entero en código si no se usan.

---

## Referencia de archivos

| Área | Archivo |
| --- | --- |
| Personaje / PG / ASI / lista efectiva de conjuros | `lib/character.ts` (`effectiveSpellKnownForCharacter`, …) |
| Catálogo y fusión repertorio preparados | `lib/spells.ts` (`mergePreparedCasterKnownWithCatalog`, …) |
| Herramientas PHB | `lib/tools.ts` |
| Pasivas / estilos (no CA) | `lib/rules-engine.ts` |
| Wizard | `app/character/new/wizard.tsx` |
| Preparación diaria + hidratar BD | `app/character/[id]/SpellDailyPrep.tsx` |
| Edición | `app/character/[id]/edit/form.tsx` |

---

## Verificación

```bash
npx tsc --noEmit && npm run dev
```

---

## Historial

- **2026-04-21 (IX)**: **Ampliación nv. 2 PHB** en `lib/spells.ts`: Auxilio, Augurio, Llama eterna, Reposo gentil, Sugestión (individual), Oscuridad, Paso brumoso, Agrandar/reducir, Calmar emociones, Calentar metal, Mensajero de los animales, Hoja de llamas, Ráfaga de viento — clases según PHB 5e (Manual del Jugador).
- **2026-04-21 (VIII)**: Preparados PHB — repertorio completo en ficha + `PATCH` de hidratación.
- **2026-04-21 (VII)**: PG rolados y `hp.levelUpRolls`.
- **2026-04-21 (VI–I)**: `asiChoices`, CA, herramientas, etc.

_Actualizar solo “Pendiente” e “Historial” al cerrar trabajo._
