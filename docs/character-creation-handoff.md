# Character creation — Handoff

> **RAW:** `docs/D&D 5E - Player's Handbook.pdf` · Texto buscable (si existe): `data/cache/handbook-pages.json` · `npm run ingest:handbook`

---

## Pendiente

_No bloqueante._ Si en mesa falta un conjuro concreto del PHB, añadirlo en `lib/spells.ts` (id kebab-case, nombre en ES, `classes` / nivel / escuela según el Manual del Jugador).

---

## Referencia de archivos

| Área | Archivo |
| --- | --- |
| Personaje / PG / ASI / lista efectiva de conjuros | `lib/character.ts` |
| Catálogo y fusión repertorio preparados | `lib/spells.ts` |
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

- **2026-04-21 (X)**: **Ampliación nv. 3 PHB** en `lib/spells.ts`: Acelerar, Lentitud, Crear comida y agua, Fingir muerte, Palabra de curación en masa, Lenguas, Muro de viento, Clarividencia — clases según PHB 5e.
- **2026-04-21 (IX)**: Ampliación nv. 2 PHB (Auxilio, Augurio, Oscuridad, Paso brumoso, etc.).
- **2026-04-21 (VIII)**: Preparados PHB — repertorio completo en ficha + `PATCH` de hidratación.
- **2026-04-21 (VII)**: PG rolados y `hp.levelUpRolls`.
- **2026-04-21 (VI–I)**: `asiChoices`, CA, herramientas, etc.

_Actualizar solo “Pendiente” e “Historial” al cerrar trabajo._
