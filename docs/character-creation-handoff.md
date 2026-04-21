# Character creation — Handoff para próximos PRs

> Contexto para que otro agente continúe los puntos pendientes de la auditoría contra el PHB 5E.
> Estado a fecha de este documento: completados los fixes **1–6**, los intermedios **3.2, 3.3, 3.4 y 3.6** de la iteración previa, el PR A (**3.1 Selección inicial de trucos y conjuros**), el PR C (**3.2 Conjuros de paladín y explorador a nivel ≥ 2**) y el PR D (**3.6 Preparación diaria del mago**).

---

## 0. Mapa rápido del código

| Área | Archivo | Qué vive aquí |
| --- | --- | --- |
| Reglas / datos / schema | `lib/character.ts` | `CharacterSchema` (Zod), `RACES`, `CLASSES`, `BACKGROUNDS`, `SKILLS`, `STANDARD_ARRAY`, `STANDARD_LANGUAGES`, helpers (`abilityMod`, `maxHpAtLevel1`, `proficiencyBonus`, `spellSlotsFor`, `computeAc`, `pointBuyTotal`, `findArmor`, `firstLevelSpellPicks`, `wizardPreparedCount`) |
| Catálogo de conjuros | `lib/spells.ts` | `SPELLS` (24 trucos + 48 conjuros de nivel 1 del PHB cap. 11), tipos `Spell`, `SpellSchool`, `SpellClassId`, helpers `spellsForClassAtLevel`, `findSpellByName` |
| Tipos raciales | `lib/character.ts` → `RaceBasics`, `RaceVariant` | `bonusLanguages`, `bonusSkills`, `speedOverride`, `hpBonusPerLevel`, `extraArmor/WeaponProficiencies`, `extraLanguages`, `damageType`, `grantedCantrips`, `cantripChoice` |
| Tipos de clase | `lib/character.ts` → `ClassBasics` | `spellcasting: { ability, caster, cantripsKnown?, spellsKnown?, preparation?, spellbookCount? }`, `startingEquipmentFixed`, `startingEquipmentChoices`, `startingGoldDice`, proficiencies |
| Trasfondos | `lib/character.ts` → `BackgroundBasics` + `BACKGROUNDS` | 13 entradas cubriendo todo el PHB core |
| Wizard UI | `app/character/new/wizard.tsx` | Stepper (`race`, `class`, `background`, `abilities`, `skills`, `spells`\*, `details`, `equipo`, `review`). El paso `spells` aparece solo si la clase tiene `cantripsKnown/spellsKnown/spellbookCount > 0` (para paladín/explorador se activa automáticamente en nivel ≥ 2) o la raza/subraza tiene `cantripChoice` |
| API | `app/api/character/route.ts` | POST valida contra `CharacterSchema`, persiste en SQLite (`lib/db.ts`) |
| Hoja | `app/character/[id]/page.tsx` + componentes relacionados | Renderiza la ficha final; sección de conjuros lista trucos/nivel 1, estado preparado y ranuras disponibles |
| PHB cache | `data/cache/handbook-pages.json` | Texto extraído por `scripts/ingest-handbook.ts`; úsalo para grepear reglas en vez del PDF |

### Fuente de verdad

El único material canónico es `docs/D&D 5E - Player's Handbook.pdf`. Por calidad OCR irregular **no uses `grep` directo sobre el PDF**; parsea `data/cache/handbook-pages.json` con un script Node. Ejemplo:

```bash
node -e "const p=require('./data/cache/handbook-pages.json'); for(const pg of p){ if(/Acolyte|Outlander/i.test(pg.text)){ console.log('==',pg.page); console.log(pg.text.slice(0,2000)); } }" | head -80
```

Si falta una regla y el cache no la cubre, regenera con `npm run ingest:handbook`.

---

## 1. Estado actual (lo que ya se hizo)

Cambios mergeados al branch de trabajo (últimas iteraciones):

1. **Spell slots (PHB p. 84–89):** `spellSlotsFor` devuelve `[]` para `half` en nivel < 2 y `third` en nivel < 3. Paladín/Ranger sin slots a nivel 1.
2. **Competencias faltantes:** Druida → `Equipo de herbolario`; Monje → `Un tipo de herramientas de artesano o instrumento musical a elección`.
3. **Equipo inicial Bárbaro:** usa `PACK_EXPLORER` (PHB p. 49).
4. **Semielfo:** `halfElfBonus` permite elegir dos +1 distintos de Carisma; se fusionan en `racialBonus`.
5. **Subrazas y ancestros dracónicos:** `RaceBasics.variants` cubre Enano (colinas, montañas), Elfo (alto, bosque, drow), Mediano (piesligeros, robusto), Gnomo (bosque, roca), Dracónido (10 ancestros).
6. **Armor Class dinámica:** `computeAc` resuelve armadura ligera/media/pesada/escudo vía `ARMORS`, aplica límites de Dex y cubre Unarmored Defense (Bárbaro, Monje).
7. **Idiomas adicionales:** `STANDARD_LANGUAGES` (16 idiomas PHB p. 123), contador global en el paso trasfondo, `proficiencies.languages` consolidado al guardar.
8. **Versatilidad de habilidades del Semielfo:** `SkillsStep` añade panel extra cuando `race.bonusSkills > 0` (Semielfo = 2).
9. **Rolled gold + equipo de trasfondo:** toggle `keepBgEquipmentOnRoll` con tooltip que explica RAW vs house rule.
10. **Trasfondos faltantes:** Charlatán, Ermitaño, Huérfano, Saltimbanqui añadidos.
11. **Selección inicial de trucos y conjuros (§3.1 resuelto — PR A):** catálogo `SPELLS` (24 trucos + 48 nivel 1 del PHB cap. 11), `ClassBasics.spellcasting` con `cantripsKnown/spellsKnown/preparation/spellbookCount` por clase, paso `"spells"` dinámico en el stepper, `grantedCantrips` y `cantripChoice` para tiefling, drow, gnomo del bosque y elfo alto, consolidación en `buildKnownSpells`, renderizado en review y ficha.
12. **Conjuros de paladín y explorador a nivel ≥ 2 (§3.2 resuelto — PR C):**
   - `paladin.spellcasting` ahora declara `preparation: "prepared"` y el explorador `preparation: "known"` con `spellsKnown: 2`. Ambos siguen con `cantripsKnown: 0` (no llevan trucos al crear).
   - `firstLevelSpellPicks` detecta `caster === "half"` y aplica la fórmula correcta:
     - Paladín (PHB p. 85): `floor(nivel / 2) + mod CAR`, mínimo 1, 0 a nivel < 2.
     - Explorador (PHB p. 91): tabla fija por nivel (`RANGER_SPELLS_KNOWN`: 2 @ nv 2, 3 @ nv 3, 4 @ nv 5, … 11 @ nv 19+).
   - En nivel 1 el paso `spells` sigue omitiéndose automáticamente para paladín/explorador; en nivel ≥ 2 aparece con los conjuros a elegir (si no hay trucos racial/de clase de por medio, tampoco pide trucos).
   - No hay cambios de UI más allá del título; la lista de conjuros existente en `SPELLS` ya incluía 10 conjuros de paladín y 11 de explorador de nivel 1 (suficientes hasta nivel 19+ de paladín y nivel 19 de explorador).
13. **Preparación diaria del mago (§3.6 resuelto — PR D):**
   - Nuevo helper `wizardPreparedCount(level, abilityScore)` en `lib/character.ts` — `level + mod INT`, mínimo 1.
   - El paso `spells` del wizard añade una tercera sección visible sólo cuando `preparation === "spellbook"` y el grimorio ya está completo: "Preparados hoy (nivel + mod INT): elige N de tu grimorio". Acotado por `chosenSpells` (no se puede preparar fuera del libro).
   - Si el jugador cambia los 6 conjuros del grimorio, los preparados que queden fuera se eliminan automáticamente.
   - `buildKnownSpells` respeta el subconjunto `chosenPrepared` cuando `preparation === "spellbook"`: esos conjuros van con `prepared: true`; el resto del grimorio con `prepared: false`. Clérigo, druida, paladín, bardo, hechicero, brujo y explorador siguen marcándose todos como preparados.
   - Validación `nextDisabled` en el paso `spells` exige llenar el panel de preparados antes de avanzar.

Verificación: `npx tsc --noEmit` pasa sin errores y los archivos tocados no reportan lints.

---

## 2. Convenciones importantes

- **IDs en español sin acento** para variantes, trasfondos y conjuros (`"laton"`, `"piesligeros"`, `"ermitano"`, `"chorro-acido"`). La raza `"dracónido"` mantiene el acento por compatibilidad con datos previos.
- **Rasgos pasivos** (Dwarven Resilience, Lucky, Gnome Cunning, Relentless Endurance, Fey Ancestry, etc.) se guardan como strings descriptivos en `traits`. **No hay motor de reglas**; sólo se muestran en la ficha. Cualquier nuevo rasgo mecánico debe añadirse a `computeAc`, `maxHp`, `firstLevelSpellPicks`, spell slots o proficiencies explícitamente.
- **Conjuros raciales**: la diferencia entre `grantedCantrips` (fijo, se guarda automáticamente) y `cantripChoice` (el jugador escoge de una lista de clase) es importante. Si añades una nueva subraza con truco fijo (ej. aasimar), usa `grantedCantrips`. Si la subraza otorga "un truco de X", usa `cantripChoice`.
- **House rule explícita (rolled gold):** el toggle de "Conservar objetos del trasfondo" arranca en `true`.
- **Paquetes `PACK_*`** viven en `lib/character.ts` arriba de `CLASSES`. Reutiliza los existentes.
- Todo el UI sigue la "Aesthetic Design System" del usuario: fuentes display, paleta acento, bordes `0.5px`, `card`/`card-accent`/`btn-accent`/`label`. No introducir Inter/Roboto. No usar markdown tables en UI.
- Idioma visible siempre en **español**; IDs internos también. Nombres de conjuros traducidos al PHB es.
- **Medio-lanzadores**: paladín (`preparation: "prepared"`) y explorador (`preparation: "known"`) dependen de `caster === "half"` para sus fórmulas específicas dentro de `firstLevelSpellPicks`. No cambies `caster` sin revisar esa rama.

---

## 3. Pendientes priorizados

### 3.1 🟢 Ampliar catálogo de conjuros — **bajo, incremental**

El catálogo actual cubre los 24 trucos y 48 conjuros de nivel 1 más representativos. Faltan:

- **Conjuros de nivel 1** que usan menos jugadores (p. ej. `ensnaring strike`, `zephyr strike`, `compelled duel`, `wrathful smite`, `searing smite`, `chaos bolt`, `arms of Hadar`, `armor of Agathys`). Añádelos a `SPELLS` con `level: 1` y la lista `classes` correspondiente.
- **Niveles 2+**: si se expande el creador a nivel >1 más allá de lanzadores completos, habrá que poblar conjuros de niveles 2–9 para cada clase. La estructura ya soporta cualquier nivel, pero `firstLevelSpellPicks` (a pesar del nombre) sólo selecciona conjuros de nivel 1. Cuando se desbloqueen los slots de nivel 2+, habrá que permitir al jugador elegir conjuros de cualquier nivel de slot disponible.

El patrón está establecido; es mecánico: abrir PHB cap. 11, traducir nombre, picar escuela y listar clases.

### 3.2 🟢 Selectores finos de herramientas / instrumentos — **cosmético**

- Monje guarda `toolProficiencies: ["Un tipo de herramientas de artesano o un instrumento musical a elección"]` como texto. Cuando exista un catálogo de herramientas/instrumentos, añadir selector concreto.
- Bardo → 3 instrumentos musicales a elección (hoy es texto).
- Trasfondos con opción abierta (`Artesano de gremio` → "Herramientas de un artesano", `Forastero` → "Un instrumento musical", `Héroe del pueblo` → "Un juego de herramientas de artesano") comparten la misma limitación.

No bloquea; afecta la granularidad de la ficha.

### 3.3 🟠 Variante Humana + Dotes (feats) — **mejora grande**

**Reglas PHB p. 31 (variante) y Ch. 6:** Variante = +1 a dos atributos distintos, 1 habilidad, 1 dote.

**Implementación sugerida:**

1. Añadir `variants` al Humano en `RACES`: `[{ id: "estandar", label: "Humano estándar" }, { id: "variante", label: "Humano variante" }]`. Estándar mantiene `abilityBonus: { fue:1, des:1, con:1, int:1, sab:1, car:1 }`. Variante apaga ese mapa y usa `customAbilityBonus: { count: 2, value: +1 }` + `bonusSkills: 1` + `bonusFeats: 1`.
2. `RaceStep` ya detecta `race.variants`; hace falta UI para elegir las 2 abilities del humano variante (patrón igual al semielfo).
3. Crear catálogo `FEATS` en `lib/character.ts` (o `lib/feats.ts` si crece) con los ~40 dotes del PHB cap. 6. Shape sugerido: `{ id, label, prerequisites?, abilityBonus?, grants: string[], extraProficiencies? }`.
4. Nuevo paso opcional `"feats"` visible cuando `bonusFeats > 0` **o** cuando el personaje es nivel ≥ 4 (ASI vs dote). En niveles ≥ 4 permitir "dote o +2 atributo".
5. Extender `CharacterSchema` con `feats: z.array(z.string()).default([])`.

**Scope grande:** considera dividir en dos PRs (variante humana + UI primero; catálogo completo de dotes con ASI después).

### 3.4 🟢 Rasgos pasivos mecánicos — **requiere motor de reglas**

Rasgos que hoy sólo son texto y deberían influir en la jugabilidad:

- Lucky (Mediano) — repetir 1s en d20.
- Brave (Mediano) — ventaja contra asustado.
- Relentless Endurance (Semiorco, 1/día).
- Gnome Cunning — ventaja en salvaciones INT/WIS/CHA contra magia.
- Dwarven Resilience — ventaja y resistencia contra veneno.
- Fey Ancestry (Elfo/Semielfo) — ventaja contra encantamiento + inmunidad al sueño.
- Savage Attacks (Semiorco) — d12 extra en crítico.
- Draconic Resistance — ya persistido como `damageType` en variantes dracónicas, falta aplicarlo al cálculo de daño recibido.
- Fleet of Foot (Elfo del bosque) — ya aplicado vía `speedOverride`.

Depende de si se construye un motor de combate/salvaciones. **No bloquea creación.** Si se aborda, centralizar en un módulo `lib/rules-engine.ts` que consuma `traits`/`variant.traits`/`damageType` y emita modificadores/ventajas.

### 3.5 🟢 Preparación diaria de clérigo, druida y paladín — **UX iterativo**

El mago ya soporta "preparados hoy" vs "en grimorio" (§1 punto 13). Los demás lanzadores preparados (clérigo, druida, paladín) siguen el patrón viejo: todos los conjuros seleccionados al crear se guardan como `prepared: true`. Técnicamente correcto, pero si se quiere permitir al jugador elegir un subconjunto mayor/menor en la creación (p. ej. un clérigo de nivel alto que ya quiera reservar algunos slots), habría que:

1. Permitir elegir más conjuros de los preparados obligatorios (p. ej. "conoces todos los de tu clase") y luego un subconjunto preparado.
2. Reutilizar la subsección existente del mago con `classSpells.filter((s) => chosenSpells.includes(s.id))` adaptada.

No urgente; la UX actual es suficiente para la mayoría de mesas.

---

## 4. Recetas rápidas

### 4.1 Añadir una nueva subraza

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
      grantedCantrips: [{ spellId: "mano-mago", ability: "int" }], // si otorga truco fijo
      // o: cantripChoice: { fromClass: "mago", ability: "int", count: 1 }
    },
  ],
},
```

`RaceStep` detecta automáticamente `race.variants`, `BackgroundStep` agrega los `bonusLanguages` al contador, y `SpellsStep` añade paneles para `grantedCantrips` / `cantripChoice`.

### 4.2 Añadir un trasfondo

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

### 4.3 Añadir un conjuro

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

### 4.4 Extender el schema para un campo nuevo

1. Añade en `CharacterSchema` (zod) con `.optional()` para mantener compatibilidad.
2. Actualiza el payload en `wizard.tsx` (`save()`).
3. Si aparece en la ficha, renderízalo en `app/character/[id]/...`.
4. Si se consulta en runtime, expón helper en `lib/character.ts`/`lib/spells.ts`.

---

## 5. Riesgos conocidos / deuda técnica

- `maxHp` asume nivel 1. Si se crea en nivel > 1, los golpes extra (promedio o rolados) no se calculan; sólo `hpBonusPerLevel` se multiplica por nivel.
- `computeAc` no considera magia (anillos, capas) ni estilos de combate (`Defense` del Guerrero +1 con armadura). Cuando se añadan, hacerlo dentro de `computeAc`.
- `firstLevelSpellPicks` sólo devuelve conteo de conjuros de nivel 1 (el nombre es legado). Cuando se desbloqueen slots de nivel 2+ en creación (nivel ≥ 3 para lanzadores completos), hará falta permitir elegir por nivel de slot.
- Catálogo `SPELLS` incompleto (§3.1). No rompe nada; sólo limita variedad — con especial foco en paladín/explorador a nivel ≥ 10, donde el catálogo ronda el límite.
- Los datos raciales/clases/conjuros están en `lib/*.ts`. Si crece mucho, partir en `lib/data/races.ts`, `lib/data/classes.ts`, `lib/data/spells/*.ts`.
- `STANDARD_LANGUAGES` está en español. Si se añade multilenguaje, externalizar.
- No hay tests automatizados; validar cambios con `npx tsc --noEmit` y flujo manual (`npm run dev`).
- ESLint no está configurado (`next lint` pide onboarding interactivo).

---

## 6. Cómo verificar cada cambio

```bash
npx tsc --noEmit              # tipado
npm run dev                    # servidor; abrir http://localhost:3000/character/new
node -e "const p=require('./data/cache/handbook-pages.json'); ..."   # consultar PHB
```

Flujo manual mínimo recomendado al tocar conjuros:

1. Crear Elfo alto · Mago · nivel 1 → el paso `Conjuros` pide 3 trucos + 6 conjuros nivel 1 + 1 truco racial de mago + 1 conjuro preparado (1 + mod INT mín 1) de entre los 6 del grimorio. En la ficha, el preparado aparece con `●` y los otros 5 con `○`.
2. Crear Elfo alto · Mago · nivel 3 → se exige preparar `3 + mod INT` (mín 1) de entre los 6 del grimorio antes de avanzar.
3. Crear Tiefling · Guerrero → el paso `Conjuros` no aparece, pero la ficha guardada incluye `Taumaturgia` en `spells.known`.
4. Crear Humano · Paladín nivel 1 → se salta el paso `Conjuros`; `spells.known` vacío; `spells.slots` vacío.
5. Crear Humano · Paladín nivel 2 → el paso `Conjuros` aparece (sin trucos, sólo preparados = `floor(2/2) + mod CAR` mín 1). `spells.slots` = `{ "1": 2 }`.
6. Crear Humano · Explorador nivel 2 → el paso `Conjuros` aparece pidiendo 2 conjuros conocidos; `spells.slots` = `{ "1": 2 }`.
7. Crear Humano · Explorador nivel 5 → pide 4 conjuros conocidos (tabla PHB p. 91).

Para regenerar cache PHB si se necesita un capítulo nuevo:

```bash
npm run ingest:handbook
```

---

## 7. Resumen de prioridades sugerido para próximos PRs

1. **PR E (mejora grande):** 3.3 Variante Humana + catálogo de dotes; extiende schema + UI.
2. **PR F (rolling):** 3.1 ampliar catálogo `SPELLS` (conjuros nivel 1 restantes, empezando por paladín/explorador si apuntamos a ficha nivel alto; luego niveles 2+ cuando el creador desbloquee slots superiores).
3. **PR G (mejora menor):** 3.2 Selectores finos de herramientas/instrumentos para Monje, Bardo y trasfondos con opción abierta.
4. **PR H (UX):** 3.5 Extender la subsección "preparados hoy" del mago a clérigo/druida/paladín si se considera valioso.
5. **PR I (largo plazo):** 3.4 Motor de reglas pasivas que consuma `traits`/`variant.*`/`damageType`.

---

_Actualiza este documento en cada PR para que el siguiente agente no empiece a ciegas._
