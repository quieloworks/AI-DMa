# Character creation — Handoff para próximos PRs

> Contexto para que otro agente continúe los puntos pendientes de la auditoría contra el PHB 5E.
> Estado a fecha de este documento: completados los fixes **1–6**, los intermedios **3.2, 3.3, 3.4 y 3.6** de la iteración previa y el PR A (**3.1 Selección inicial de trucos y conjuros**).

---

## 0. Mapa rápido del código

| Área | Archivo | Qué vive aquí |
| --- | --- | --- |
| Reglas / datos / schema | `lib/character.ts` | `CharacterSchema` (Zod), `RACES`, `CLASSES`, `BACKGROUNDS`, `SKILLS`, `STANDARD_ARRAY`, `STANDARD_LANGUAGES`, helpers (`abilityMod`, `maxHpAtLevel1`, `proficiencyBonus`, `spellSlotsFor`, `computeAc`, `pointBuyTotal`, `findArmor`, `firstLevelSpellPicks`) |
| Catálogo de conjuros | `lib/spells.ts` | `SPELLS` (24 trucos + 48 conjuros de nivel 1 del PHB cap. 11), tipos `Spell`, `SpellSchool`, `SpellClassId`, helpers `spellsForClassAtLevel`, `findSpellByName` |
| Tipos raciales | `lib/character.ts` → `RaceBasics`, `RaceVariant` | `bonusLanguages`, `bonusSkills`, `speedOverride`, `hpBonusPerLevel`, `extraArmor/WeaponProficiencies`, `extraLanguages`, `damageType`, `grantedCantrips`, `cantripChoice` |
| Tipos de clase | `lib/character.ts` → `ClassBasics` | `spellcasting: { ability, caster, cantripsKnown?, spellsKnown?, preparation?, spellbookCount? }`, `startingEquipmentFixed`, `startingEquipmentChoices`, `startingGoldDice`, proficiencies |
| Trasfondos | `lib/character.ts` → `BackgroundBasics` + `BACKGROUNDS` | 13 entradas cubriendo todo el PHB core |
| Wizard UI | `app/character/new/wizard.tsx` | Stepper (`race`, `class`, `background`, `abilities`, `skills`, `spells`\*, `details`, `equipo`, `review`). El paso `spells` aparece solo si la clase tiene `cantripsKnown/spellsKnown/spellbookCount > 0` o la raza/subraza tiene `cantripChoice` |
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
11. **Selección inicial de trucos y conjuros (§3.1 resuelto — PR A):**
   - Catálogo `SPELLS` en `lib/spells.ts` con los trucos y conjuros de nivel 1 más usados del PHB cap. 11 (24 trucos + 48 nivel 1) cubriendo las 8 clases lanzadoras (bardo, clérigo, druida, hechicero, brujo, mago, paladín, explorador). Nombres en español; ids kebab-case sin acentos.
   - `ClassBasics.spellcasting` ampliado con `cantripsKnown`, `spellsKnown`, `preparation: "known" | "prepared" | "spellbook"` y `spellbookCount`. Cada clase lanzadora del PHB tiene los conteos canónicos de nivel 1 (Bardo 2/4, Clérigo 3/prep, Druida 2/prep, Hechicero 4/2, Brujo 2/2, Mago 3/6-grimorio). Paladín y explorador quedan con `cantripsKnown: 0` para saltarse el paso al nivel 1.
   - `RaceBasics`/`RaceVariant` ampliadas con `grantedCantrips: RacialCantrip[]` y `cantripChoice: RacialCantripChoice`. Conectados:
     - **Tiefling** → `Taumaturgia` (CAR) granted.
     - **Gnomo del bosque** → `Ilusión menor` (INT) granted.
     - **Drow** → `Luces danzantes` (CAR) granted.
     - **Elfo alto** → `cantripChoice { fromClass: "mago", ability: "int", count: 1 }`.
   - Nuevo paso `"spells"` en el stepper entre `skills` y `details`. Se oculta automáticamente (tanto en UI como en el flujo `goNext/goPrev`) cuando la clase no necesita conjuros y la raza no otorga elección. El paso muestra tres secciones: trucos de clase, conjuros de nivel 1 de clase y selector racial (si aplica). Incluye un panel informativo con los trucos ya otorgados automáticamente (tiefling, drow, gnomo del bosque).
   - `buildKnownSpells` consolida en `spells.known` todo lo seleccionado + los grants raciales. Para el mago los 6 conjuros del grimorio se guardan con `prepared: false`; para el resto con `prepared: true`. Los slots de nivel 1 se siguen calculando vía `spellSlotsFor`.
   - Review final (`ReviewStep`) y hoja del personaje (`app/character/[id]/page.tsx`) renderizan la sección de conjuros con trucos/nivel 1 + badges de ranuras por nivel + marcador `●/○` para preparado vs en grimorio.

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

---

## 3. Pendientes priorizados

### 3.1 🟢 Ampliar catálogo de conjuros — **bajo, incremental**

El catálogo actual cubre los 24 trucos y 48 conjuros de nivel 1 más representativos. Faltan:

- **Conjuros de nivel 1** que usan menos jugadores (p. ej. `ensnaring strike`, `zephyr strike`, `compelled duel`, `wrathful smite`, `searing smite`, `chaos bolt`, `arms of Hadar`, `armor of Agathys`). Añádelos a `SPELLS` con `level: 1` y la lista `classes` correspondiente.
- **Niveles 2+**: si se expande el creador a nivel >1, habrá que poblar conjuros de niveles 2–9 para cada clase. La estructura ya soporta cualquier nivel.

El patrón está establecido; es mecánico: abrir PHB cap. 11, traducir nombre, picar escuela y listar clases.

### 3.2 🟡 Conjuros de paladín y explorador a nivel ≥ 2 — **pequeño pero importante**

**Problema:** hoy `ClassBasics.spellcasting` para paladín/explorador declara `cantripsKnown: 0` y no define `preparation`, por lo que `firstLevelSpellPicks` devuelve 0 incluso si el usuario crea el personaje en nivel ≥ 2. RAW (PHB p. 85 Paladin / p. 91 Ranger):

- **Paladín**: nivel ≥ 2, prepara `mitad del nivel (redondeo abajo) + mod CAR`, mínimo 1.
- **Explorador**: nivel ≥ 2, conoce 2 conjuros de nivel 1 (+1 a niveles 3 y 5); es lanzador "known".

**Implementación sugerida:**

1. Añadir `preparation: "prepared"` a `paladin.spellcasting` y `preparation: "known"` + `spellsKnown: 2` a `explorador.spellcasting`.
2. Ampliar `firstLevelSpellPicks` para que el paladín devuelva `0` cuando `level < 2` y luego aplique la fórmula `floor(level/2) + mod CAR` (mín 1). Tendrá que distinguirse del clérigo/druida (que ya usan `level + mod`). La forma más limpia es añadir un tercer valor a `preparation`: p. ej. `"prepared-half"`.
3. Sumar la lógica de "aprendidos del explorador" (sube con nivel): habrá que llevar `spellsKnown` a una función en vez de un número fijo.
4. En el paso `spells` del wizard no hay que tocar nada salvo si decides mostrar ranuras previstas.

### 3.3 🟢 Idiomas/herramientas otorgados manualmente — **cosmético**

- Monje guarda `toolProficiencies: ["Un tipo de herramientas de artesano o un instrumento musical a elección"]` como texto. Cuando exista un catálogo de herramientas/instrumentos, añadir selector concreto.
- Bardo → 3 instrumentos musicales a elección (hoy es texto).

No bloquea; afecta la granularidad de la ficha.

### 3.4 🟢 Variante Humana + Dotes (feats) — **mejora grande**

**Reglas PHB p. 31 (variante) y Ch. 6:** Variante = +1 a dos atributos distintos, 1 habilidad, 1 dote.

**Implementación sugerida:**

1. Añadir `variants` al Humano en `RACES`: `[{ id: "estandar", label: "Humano estándar" }, { id: "variante", label: "Humano variante" }]`. Estándar mantiene `abilityBonus: { fue:1, des:1, con:1, int:1, sab:1, car:1 }`. Variante apaga ese mapa y usa `customAbilityBonus: { count: 2, value: +1 }` + `bonusSkills: 1` + `bonusFeats: 1`.
2. `RaceStep` ya detecta `race.variants`; hace falta UI para elegir las 2 abilities del humano variante (patrón igual al semielfo).
3. Crear catálogo `FEATS` en `lib/character.ts` (o `lib/feats.ts` si crece) con los ~40 dotes del PHB cap. 6. Shape sugerido: `{ id, label, prerequisites?, abilityBonus?, grants: string[], extraProficiencies? }`.
4. Nuevo paso opcional `"feats"` visible cuando `bonusFeats > 0` **o** cuando el personaje es nivel ≥ 4 (ASI vs dote). En niveles ≥ 4 permitir "dote o +2 atributo".
5. Extender `CharacterSchema` con `feats: z.array(z.string()).default([])`.

**Scope grande:** considera dividir en dos PRs (variante humana + UI primero; catálogo completo de dotes con ASI después).

### 3.5 🟢 Rasgos pasivos mecánicos — **requiere motor de reglas**

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

### 3.6 🟢 Preparación diaria del mago — **mejora UX**

Hoy al crear un mago se piden 3 trucos + 6 conjuros del grimorio, guardándolos todos como `prepared: false`. El PHB dice que de esos 6 debe preparar `nivel + mod INT` (mín 1). Hace falta una subsección adicional dentro del paso `spells` que permita marcar qué conjuros del grimorio van preparados al crear la ficha (y persistirlos con `prepared: true`). Mismo patrón servirá para permitir a clérigo/druida cambiar la selección.

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
- `firstLevelSpellPicks` actualmente sólo cubre nivel 1; paladín/explorador y mago con grimorio ≥ 2 quedan pendientes (§3.2, §3.6).
- Catálogo `SPELLS` incompleto (§3.1). No rompe nada; sólo limita variedad.
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

1. Crear Elfo alto · Mago · Cualquier trasfondo → el paso `Conjuros` pide 3 trucos de mago + 6 conjuros nivel 1 de mago + 1 truco racial de mago. Al guardar, la ficha muestra los 10 (los 6 del grimorio con `○`).
2. Crear Tiefling · Guerrero → el paso `Conjuros` no aparece, pero la ficha guardada incluye `Taumaturgia` en `spells.known`.
3. Crear Humano · Paladín nivel 1 → se salta el paso `Conjuros`; `spells.known` vacío; `spells.slots` vacío.

Para regenerar cache PHB si se necesita un capítulo nuevo:

```bash
npm run ingest:handbook
```

---

## 7. Resumen de prioridades sugerido para próximos PRs

1. **PR B (mejora grande):** 3.4 Variante Humana + catálogo de dotes; extiende schema + UI.
2. **PR C (pequeño):** 3.2 Conjuros de paladín y explorador a nivel ≥ 2.
3. **PR D (mejora UX):** 3.6 Preparación diaria del mago (marcar qué conjuros del grimorio van preparados al crear).
4. **PR E (mejora menor):** 3.3 Selectores finos de herramientas/instrumentos para Monje, Bardo y trasfondos con opción abierta.
5. **PR F (largo plazo):** 3.5 Motor de reglas pasivas que consuma `traits`/`variant.*`/`damageType`.
6. **Rolling:** 3.1 ampliar catálogo `SPELLS` (conjuros nivel 1 restantes y niveles 2+).

---

_Actualiza este documento en cada PR para que el siguiente agente no empiece a ciegas._
