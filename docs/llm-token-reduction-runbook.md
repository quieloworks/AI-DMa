# Runbook: reducción de tokens del LLM (DM por turno)

Este documento describe **qué se cambió**, **cómo medirlo** y **cómo activar perfiles de ahorro** sin romper el contrato `<narrativa>` / `<acciones>` ni el JSON que consume el servidor.

## Objetivo y límites

- **Objetivo**: bajar tokens de **entrada** enviados al proveedor externo (OpenAI, Anthropic, Gemini, OpenRouter, Groq, Ollama, etc.) en cada `POST /api/chat`.
- **No tocar**: formato de salida exigido al modelo (`<narrativa>`…`</narrativa>` + `<acciones>`… JSON), ni la lógica de [`parseDmResponse`](../server/dm/prompts.ts) / [`applyDmActions`](../server/dm/apply-actions.ts).
- **Cada turno** el cuerpo del request sigue siendo **2 mensajes**: `system` + `user` (sin historial multi-turno al proveedor).

## Archivos relevantes

| Archivo | Rol |
|---------|-----|
| [`server/dm/prompts.ts`](../server/dm/prompts.ts) | Texto del system: directivas compactas, combate condicional, truncado RAG parametrizable. |
| [`server/dm/prompt-budget.ts`](../server/dm/prompt-budget.ts) | Lectura de `DM_PROMPT_BUDGET` y variables `DM_RAG_*`. |
| [`app/api/chat/route.ts`](../app/api/chat/route.ts) | Arma `snap` (incl. `combat`), llama RAG con `k`, pasa `ragCaps` a los builders. |
| [`scripts/measure-dm-prompts.ts`](../scripts/measure-dm-prompts.ts) | Medición local de longitudes sin API. |

## Medición reproducible (baseline y después)

Desde la raíz del repositorio:

```bash
npm run measure:dm-prompts
```

El script imprime longitud en **caracteres** del `system` y una estimación **conservadora** `tokens ≈ ceil(chars/4)` solo para comparar escenarios (apertura, turno jugador, combate activo, módulo, asistente) con caps `default` vs `savings` simulados en el propio script.

Para ver el efecto del **perfil del servidor** en los valores por defecto de `k` y caps (cuando no pasas overrides), ejecuta el mismo comando con variables de entorno **antes** de arrancar `npm run dev` / `npm start`:

```bash
DM_PROMPT_BUDGET=savings npm run measure:dm-prompts
```

*(El script de medición usa caps explícitos en la tabla; el servidor usa [`getDmRagBudget()`](../server/dm/prompt-budget.ts) en tiempo real.)*

## Variables de entorno (presupuesto RAG)

| Variable | Significado |
|----------|-------------|
| `DM_PROMPT_BUDGET` | `default` (omitir = igual) o `savings` / `save` para valores más agresivos de `k` y truncado. |
| `DM_RAG_RULES_K` | Top-k fragmentos del Handbook (override numérico). |
| `DM_RAG_ADVENTURE_K` | Top-k fragmentos del módulo PDF ingerido. |
| `DM_RAG_RULES_CHAR_CAP` | Máx. caracteres por chunk de reglas en el prompt. |
| `DM_RAG_ADVENTURE_CHAR_CAP` | Máx. caracteres por chunk de aventura en el prompt. |

### Perfiles recomendados

| Perfil | rulesK | adventureK | rulesChunkChars | adventureChunkChars |
|--------|--------|--------------|-----------------|---------------------|
| `default` | 5 | 6 | 900 | 1200 |
| `savings` | 4 | 4 | 600 | 800 |

Con `DM_PROMPT_BUDGET=default`, puedes subir o bajar cualquier valor con las variables `DM_RAG_*`. Con `savings`, los defaults base son los de la fila savings salvo override explícito.

## Cambios de comportamiento del prompt (resumen técnico)

1. **`combat` en el snapshot**: [`route.ts`](../app/api/chat/route.ts) pasa `snap.combat` desde `state_json.combat`. Así el system incluye el bloque largo de combate **solo** cuando `combat === true` **o** hay **iniciativa** en curso (transición / combate en curso).
2. **Fuera de combate**: se envía un **COMBAT_HINT** corto (cómo declarar combate, mapa, iniciativa) en lugar del bloque completo de mecánica de combate.
3. **Directivas** (engagement, mecánica, resolución, tono, dificultad, formato, módulo) están **redactadas en menos caracteres** manteniendo las mismas obligaciones y nombres de claves JSON.
4. **Modo asistente** reutiliza la misma cola de directivas (`sharedDirectiveTail`) sin el bloque de “integración del grupo” narrativa.

## Fases de implementación (checklist)

Marca al avanzar. El código ya incorpora las fases 2–5; esta lista sirve para auditoría o despliegue gradual.

- [ ] **Fase 0 — Medición**: `npm run measure:dm-prompts` y anotar una línea de referencia (modelo/proveedor que uses en producción).
- [ ] **Fase 1 — Baseline en runtime**: con `DM_PROMPT_BUDGET` sin definir, jugar 1 turno y confirmar que el DM sigue emitiendo `dice_requests` cuando toca.
- [ ] **Fase 2 — Ahorro conservador**: `DM_PROMPT_BUDGET=savings`, repetir Fase 1; si baja calidad, sube solo `DM_RAG_RULES_K` o caps antes de volver a `default`.
- [ ] **Fase 3 — Combate**: iniciar combate, comprobar `battle_map`, iniciativa y `hp_changes`; terminar combate (`combat_end`) y verificar que el hint corto vuelve cuando no hay iniciativa ni `combat`.
- [ ] **Fase 4 — Módulo PDF**: historia con aventura ingerida; el DM debe respetar fragmentos `[A#]` y el esquema.
- [ ] **Fase 5 — Asistente**: modo asistente del DM, pregunta técnica; salida sigue siendo nota + `<acciones>`.

## Matriz de regresión manual (mínima)

| Caso | Qué comprobar |
|------|----------------|
| Apertura | Respuesta con dos bloques; escena inicial coherente. |
| Jugador (sigilo/ataque) | `dice_requests` antes del resultado cuando aplica. |
| Combate | `combat`, `battle_map`, iniciativa; actualización por turno. |
| Módulo | Hechos del PDF no contradichos; uso de outline + RAG. |
| Asistente | Respuesta breve para el DM humano; JSON útil en `<acciones>`. |

## Rollback

1. Eliminar o desactivar variables `DM_PROMPT_BUDGET` y `DM_RAG_*` (vuelve al comportamiento **default** del código: 5/6 chunks, 900/1200 chars).
2. Si despliegues código antiguo, restaurar la versión anterior de [`server/dm/prompts.ts`](../server/dm/prompts.ts) y [`prompt-budget.ts`](../server/dm/prompt-budget.ts).

## Ingesta de módulo (fuera de “cada turno”)

[`summarizeAdventure`](../server/adventure.ts) hace una llamada separada al ingerir un PDF de aventura. Reducir `getAdventureHeadSample` o `maxTokens` del resumen ahorra esa llamada concreta pero puede degradar el esquema del módulo; no forma parte del cambio por turno documentado aquí.

## Resultados de medición de referencia (rellenar tras ejecutar)

Ejemplo local con RAG sintético al máximo de cada cap (5×900 + módulo según escenario): `npm run measure:dm-prompts`.

| Escenario | system (chars) | ~tokens (÷4) |
|-----------|------------------|---------------|
| opening + default caps | 8547 | ~2137 |
| opening + savings caps | 7047 | ~1762 |
| player + default | 8298 | ~2075 |
| player + savings caps | 6798 | ~1700 |
| combat ON + default | 8725 | ~2182 |
| assistant + default | 8113 | ~2029 |

Los números reales dependen de tu texto de RAG, resumen y módulo; usa el script tras cada cambio relevante.
