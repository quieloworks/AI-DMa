# Character creation — Handoff de pendientes

> Contexto para que otro agente continúe los puntos abiertos de la auditoría contra el PHB 5E.
> Al cerrarse el **PR G (§3.3.3: tope RAW de 20 en atributos)**, el creador cumple RAW en
> raza, subraza, trasfondo, idiomas, armadura, HP nivel 1, ASI/dote hasta 19 con tope 20,
> catálogo de conjuros de nivel 1 por clase, preparación diaria de mago, trucos raciales y
> selección inicial de conjuros para paladín/explorador ≥ nivel 2.
> Este archivo se mantiene como lista viva de lo que todavía falta.

---

## 0. Mapa rápido del código

| Área | Archivo | Qué vive aquí |
| --- | --- | --- |
| Reglas / datos / schema | `lib/character.ts` | `CharacterSchema` (Zod, con `feats: string[]`), `RACES`, `CLASSES`, `BACKGROUNDS`, `SKILLS`, `STANDARD_ARRAY`, `STANDARD_LANGUAGES`, helpers (`abilityMod`, `maxHpAtLevel1`, `proficiencyBonus`, `spellSlotsFor`, `computeAc`, `pointBuyTotal`, `findArmor`, `firstLevelSpellPicks`, `wizardPreparedCount`, `asiCountForClassAtLevel`, `asiLevelsForClass`) |
| Catálogo de conjuros | `lib/spells.ts` | `SPELLS` (24 trucos + ~60 conjuros de nivel 1 + 2 conjuros de nivel 3 del PHB cap. 11), tipos `Spell`, `SpellSchool`, `SpellClassId`, helpers `spellsForClassAtLevel`, `findSpellByName` |
| Catálogo de dotes | `lib/feats.ts` | `FEATS` (42 dotes del PHB cap. 6), tipo `Feat` (`abilityBonus?`, `prerequisite?`, `summary`, `grants[]`), helper `findFeat` |
| Tipos raciales | `lib/character.ts` → `RaceBasics`, `RaceVariant` | `bonusLanguages`, `bonusSkills`, `bonusFeats`, `customAbilityBonus`, `speedOverride`, `hpBonusPerLevel`, `extraArmor/WeaponProficiencies`, `extraLanguages`, `damageType`, `grantedCantrips`, `cantripChoice` |
| Tipos de clase | `lib/character.ts` → `ClassBasics` | `spellcasting: { ability, caster, cantripsKnown?, spellsKnown?, preparation?, spellbookCount? }`, `startingEquipmentFixed`, `startingEquipmentChoices`, `startingGoldDice`, proficiencies |
| Trasfondos | `lib/character.ts` → `BackgroundBasics` + `BACKGROUNDS` | 13 entradas cubriendo todo el PHB core |
| Wizard UI | `app/character/new/wizard.tsx` | Stepper (`race`, `class`, `background`, `abilities`, `feats` label "Mejoras", `skills`, `spells`, `details`, `equipo`, `review`). El paso `feats` aparece si la raza/subraza otorga `bonusFeats > 0` o la clase tiene ≥ 1 ASI (`asiCountForClassAtLevel`). Tope RAW de 20 enforzado vía `asiSlotPreTotals` (memo que excluye la contribución del propio slot) — se pasa a `AsiSlot` y deshabilita tanto los botones de atributo como las opciones de dote que empujarían un atributo por encima de 20 |
| API | `app/api/character/route.ts` | POST valida contra `CharacterSchema`, persiste en SQLite (`lib/db.ts`) |
| Hoja | `app/character/[id]/page.tsx` + componentes relacionados | Renderiza la ficha final; sección de conjuros lista trucos/nivel 1, estado preparado y ranuras; sección "Dotes" con resolve vía `findFeat(id)` |
| PHB cache | `data/cache/handbook-pages.json` | Texto extraído por `scripts/ingest-handbook.ts`; úsalo para grepear reglas en vez del PDF |

### Fuente de verdad

El único material canónico es `docs/D&D 5E - Player's Handbook.pdf`. Por calidad OCR irregular **no uses `grep` directo sobre el PDF**; parsea `data/cache/handbook-pages.json` con un script Node:

```bash
node -e "const p=require('./data/cache/handbook-pages.json'); for(const pg of p){ if(/Acolyte|Outlander/i.test(pg.text)){ console.log('==',pg.page); console.log(pg.text.slice(0,2000)); } }" | head -80
```

Si falta una regla, regenera con `npm run ingest:handbook`.

---

## 1. Convenciones activas (léelas antes de tocar nada)

- **IDs en español sin acento** para variantes, trasfondos y conjuros (`"laton"`, `"piesligeros"`, `"ermitano"`, `"chorro-acido"`). La raza `"dracónido"` mantiene el acento por compatibilidad con datos previos.
- **Rasgos pasivos** (Dwarven Resilience, Lucky, Gnome Cunning, Relentless Endurance, Fey Ancestry, etc.) se guardan como strings en `traits`. **No hay motor de reglas**; sólo se muestran en la ficha. Cualquier nuevo rasgo mecánico debe conectarse explícitamente a `computeAc`, `maxHp`, `firstLevelSpellPicks`, spell slots o proficiencies.
- **Conjuros raciales**: `grantedCantrips` = fijo (se guarda automáticamente); `cantripChoice` = el jugador escoge de una lista de clase. Si añades subraza con truco fijo (ej. aasimar), usa `grantedCantrips`.
- **House rule rolled gold:** el toggle "Conservar objetos del trasfondo" arranca en `true`.
- **Paquetes `PACK_*`** en `lib/character.ts` encima de `CLASSES`. Reutiliza los existentes.
- UI en **Aesthetic Design System** del usuario: fuentes display, paleta acento, bordes `0.5px`, `card`/`card-accent`/`btn-accent`/`label`. No Inter/Roboto. No markdown tables en UI.
- Idioma visible siempre en **español**; IDs internos también. Nombres de conjuros traducidos al PHB es.
- **Medio-lanzadores**: paladín (`preparation: "prepared"`) y explorador (`preparation: "known"` con `spellsKnown: 2`). `firstLevelSpellPicks` tiene ramas específicas cuando `caster === "half"` — no cambies `caster` sin revisar esa rama.
- **Tope RAW de 20** (PHB p. 12 y p. 165): `asiSlotPreTotals` es la fuente única. Si añades una nueva vía de bonus a atributos, réstala en el memo o el enforcement se desincroniza.

---

## 2. Pendientes priorizados

### 2.1 🟢 Ampliar catálogo de conjuros — bajo, incremental

El catálogo actual cubre los 24 trucos y ~60 conjuros de nivel 1 más representativos (PHB cap. 11), incluyendo smites de paladín, conjuros iniciales de brujo y de explorador. Lo que queda:

- **Huecos de nivel 1** menos usados (`find traps`, `witch bolt` variantes, `sanctuary` ya está, `protection from evil` ya está). Revisar PHB cap. 11 por clase y rellenar con el patrón del archivo.
- **Niveles 2+**: cuando el creador se amplíe a elección de conjuros de nivel 2–9 (lanzadores completos a nivel ≥ 3), hay que poblar catálogo por nivel y por clase. La estructura `Spell.level` ya soporta cualquier nivel, pero `firstLevelSpellPicks` (nombre legado) sólo elige nivel 1. Para desbloquear la elección por nivel hay que:
  1. Generalizar el helper a `spellPicksForLevel(spellcasting, characterLevel, abilityScore, spellLevel)` o devolver un mapa `{ [spellLevel]: count }`.
  2. Añadir una columna por nivel de slot en `SpellsStep`.
  3. Validar en `nextDisabled` la suma por nivel.

### 2.2 🟢 Selectores finos de herramientas / instrumentos — cosmético

Hoy estos campos se persisten como texto abierto:

- Monje → `toolProficiencies: ["Un tipo de herramientas de artesano o un instrumento musical a elección"]`.
- Bardo → 3 instrumentos musicales a elección.
- Trasfondos con opción abierta: `Artesano de gremio` ("Herramientas de un artesano"), `Forastero` ("Un instrumento musical"), `Héroe del pueblo` ("Un juego de herramientas de artesano").

Para cerrarlo: crear un catálogo en `lib/tools.ts` (tipo `Tool = { id; name; category: "artisan" | "instrument" | "gaming" | "vehicle" | "other" }`) y un selector multi-choice reutilizable en el wizard que filtre por categoría.

### 2.3 🟢 Rasgos pasivos mecánicos — requiere motor de reglas

Rasgos que hoy sólo son texto y deberían afectar jugabilidad:

- Lucky (Mediano) — repetir 1s en d20.
- Brave (Mediano) — ventaja contra asustado.
- Relentless Endurance (Semiorco, 1/día).
- Gnome Cunning — ventaja en salvaciones INT/WIS/CHA contra magia.
- Dwarven Resilience — ventaja y resistencia contra veneno.
- Fey Ancestry (Elfo/Semielfo) — ventaja contra encantamiento + inmunidad al sueño.
- Savage Attacks (Semiorco) — d12 extra en crítico.
- Draconic Resistance — ya persistido como `damageType` en variantes dracónicas, falta aplicarlo al cálculo de daño recibido.
- Fleet of Foot (Elfo del bosque) — ya aplicado vía `speedOverride`.

Depende de si se construye un motor de combate/salvaciones. No bloquea creación. Si se aborda, centralizar en `lib/rules-engine.ts` que consuma `traits`/`variant.traits`/`damageType` y emita modificadores/ventajas.

### 2.4 🟢 Preparación diaria para clérigo, druida y paladín — UX iterativo

Sólo el mago tiene UX de "preparados hoy" vs "en grimorio" (`preparation: "spellbook"`). Los demás lanzadores preparados (clérigo, druida, paladín) guardan todo lo elegido como `prepared: true`. Técnicamente correcto; mejora opcional:

1. Permitir escoger todo el repertorio de clase (clérigo/druida conocen la lista completa por RAW) y luego un subconjunto preparado = `nivel + mod de atributo`.
2. Reutilizar la subsección del mago adaptada: `classSpells.filter((s) => chosenSpells.includes(s.id))` pasa a `classSpells` completa para clérigo/druida.

No urgente; la UX actual cubre la creación estándar.

### 2.5 🟢 Persistencia estructurada del desglose racial vs ASI — opcional

Hoy el payload aplana todo en `abilityRacialBonus: Record<Ability, number>` y `feats: string[]`. Si el futuro motor de reglas o la hoja quieren distinguir "ASI nivel 4 (guerrero)" vs "dote racial (humano variante)", hace falta persistir `asiChoices` en `CharacterSchema` (añadir `asiChoices?: AsiChoice[]` opcional, mapear de `wizard.tsx` al payload). Para creación no es necesario.

### 2.6 🟢 HP y dados de golpe a niveles > 1 — deuda

`maxHpAtLevel1(hitDie, conMod)` sólo resuelve nivel 1. Al crear personajes de nivel > 1 actualmente se multiplica sólo `hpBonusPerLevel` por nivel, pero los dados de golpe extra **no se suman** (ni promedio ni rolados). Si el creador oficialmente soporta niveles altos, hay que:

1. Extender a `maxHpAtLevel(hitDie, conMod, level, mode: "average" | "rolled")`.
2. Añadir UI para elegir modo o dejarlo fijo en promedio PHB.
3. Llamarlo desde `wizard.tsx` donde hoy se usa `maxHpAtLevel1`.

### 2.7 🟢 `computeAc` sin estilos de combate ni magia — deuda

Falta:

- Estilo `Defense` del Guerrero / Paladín / Explorador (+1 CA con armadura).
- Modificadores mágicos (anillo de protección, capa, escudo +1…).

Al añadir, centralizarlo en `computeAc` para que AC siga reflejando el equipo actual.

---

## 3. Recetas rápidas

### 3.1 Añadir una nueva subraza

```ts
{
  id: "enano",
  // ...
  variants: [
    // ...
    {
      id: "grimo",
      label: "Enano grimo (ejemplo)",
      abilityBonus: { fue: 1 },
      traits: ["Bla bla"],
      extraWeaponProficiencies: ["Martillo de guerra"],
      bonusLanguages: 1,
      grantedCantrips: [{ spellId: "mano-mago", ability: "int" }],
      // o: cantripChoice: { fromClass: "mago", ability: "int", count: 1 }
    },
  ],
},
```

`RaceStep` detecta automáticamente `race.variants`, `BackgroundStep` suma los `bonusLanguages` al contador, y `SpellsStep` añade paneles para `grantedCantrips` / `cantripChoice`.

### 3.2 Añadir un trasfondo

```ts
{
  id: "marinero",
  label: "Marinero",
  skillProficiencies: ["atletismo", "percepcion"],
  languages: 0,
  tools: ["Herramientas de navegante", "Vehículos acuáticos"],
  startingMoney: { gp: 10 },
  equipment: ["Clavija de atraque", "18 m de cuerda de seda", "Amuleto de la suerte", "Atuendo común"],
  feature: { name: "Pasaje gratis", text: "Puedes conseguir pasaje gratuito en un barco mercante..." },
},
```

### 3.3 Añadir un conjuro

```ts
// lib/spells.ts
{
  id: "golpe-abrasador",
  name: "Golpe abrasador",
  level: 1,
  school: "evocacion",
  classes: ["paladin"],
  concentration: true,
  description: "Tu siguiente ataque hace 1d6 daño de fuego extra y prende al objetivo…",
},
```

El UI recoge automáticamente cualquier conjuro cuyo `classes[]` incluya la clase seleccionada.

### 3.4 Extender el schema

1. Añade el campo en `CharacterSchema` (zod) con `.optional()`.
2. Actualiza el payload en `wizard.tsx` (`save()`).
3. Si aparece en la ficha, renderízalo en `app/character/[id]/...`.
4. Si se consulta en runtime, expón helper en `lib/character.ts`/`lib/spells.ts`.

---

## 4. Riesgos conocidos / deuda técnica

- `maxHp` asume nivel 1 (ver §2.6).
- `computeAc` no considera magia ni estilos de combate (ver §2.7).
- `firstLevelSpellPicks` sólo devuelve conteo de conjuros de nivel 1 (ver §2.1).
- Catálogo `SPELLS` incompleto (§2.1). Con especial foco en paladín/explorador a nivel ≥ 10, donde el catálogo ronda el límite.
- Los datos raciales/clases/conjuros están en `lib/*.ts`. Si crece mucho, partir en `lib/data/races.ts`, `lib/data/classes.ts`, `lib/data/spells/*.ts`.
- `STANDARD_LANGUAGES` está en español. Si se añade multilenguaje, externalizar.
- No hay tests automatizados; validar cambios con `npx tsc --noEmit` y flujo manual (`npm run dev`).
- ESLint no está configurado (`next lint` pide onboarding interactivo).

---

## 5. Cómo verificar cada cambio

```bash
npx tsc --noEmit              # tipado
npm run dev                   # servidor; abrir http://localhost:3000/character/new
```

Flujo manual mínimo al tocar conjuros:

1. Crear Elfo alto · Mago · nivel 1 → paso `Conjuros` pide 3 trucos + 6 conjuros nivel 1 + 1 truco racial de mago + 1 conjuro preparado (1 + mod INT mín 1). Ficha muestra preparado con `●` y los otros con `○`.
2. Crear Elfo alto · Mago · nivel 3 → exige preparar `3 + mod INT` (mín 1) de entre los 6 del grimorio.
3. Crear Tiefling · Guerrero → el paso `Conjuros` no aparece; la ficha incluye `Taumaturgia` en `spells.known`.
4. Crear Humano · Paladín nivel 1 → se salta `Conjuros`; `spells.known` vacío; `spells.slots` vacío.
5. Crear Humano · Paladín nivel 2 → `Conjuros` aparece sin trucos, preparados = `floor(2/2) + mod CAR` mín 1; `spells.slots = { "1": 2 }`.
6. Crear Humano · Explorador nivel 5 → pide 4 conjuros conocidos (tabla PHB p. 91).

Flujo manual al tocar ASI / tope de 20:

7. Crear Guerrero nivel 12 con FUE 15 + humano variante (+1 FUE custom). En cada ASI (niveles 4, 6, 8) gastar todo en FUE: los dos primeros concentran +2 y llegan a 19; en el tercero, los botones de "Concentrar en +2 FUE" y el +1 FUE deben aparecer deshabilitados con tooltip "Subir Fuerza superaría el tope de 20".
8. Crear Pícaro nivel 10 con SAB 15. En el ASI del nivel 10, seleccionar la dote **Observador** (+1 INT o SAB) con SAB ya en 20 → el botón de SAB aparece deshabilitado dentro del panel del dote; el de INT permanece disponible.

Regenerar cache PHB si hace falta un capítulo nuevo:

```bash
npm run ingest:handbook
```

---

## 6. Orden sugerido de los próximos PRs

1. **2.6 + 2.7 (rolling):** cerrar `maxHp` para nivel > 1 y estilos de combate/AC; son mejoras concretas con patrón claro.
2. **2.1 (rolling):** ampliar `SPELLS` a nivel 2+ junto con la generalización de `firstLevelSpellPicks` → `spellPicksForLevel`, y actualizar `SpellsStep` para renderizar selección por nivel de slot.
3. **2.2 (pulido):** catálogo de herramientas/instrumentos + selector en wizard (monje/bardo/trasfondos abiertos).
4. **2.4 (UX):** extender la subsección "preparados hoy" del mago a clérigo/druida/paladín.
5. **2.5 (opcional):** persistir `asiChoices` estructurado en el schema.
6. **2.3 (largo plazo):** `lib/rules-engine.ts` para rasgos pasivos (Lucky, Fey Ancestry, Gnome Cunning, Draconic Resistance, Dwarven Resilience, Relentless Endurance, Savage Attacks).

---

_Actualiza este documento en cada PR para que el siguiente agente no empiece a ciegas._
