# Mesa — Dungeon Master local

Aplicación web fullstack para jugar D&D 5E con un Dungeon Master impulsado por **gemma4:e2b** vía Ollama *o* cualquier proveedor externo que conectes (OpenAI, Anthropic, Gemini, OpenRouter, Groq). Incluye RAG sobre el *Player's Handbook*, creación de personajes con exportación a PDF, narración por voz local (Piper) o cloud (OpenAI TTS, ElevenLabs), generación de imágenes de escena (DALL·E / Imagen / Stability) y una vista móvil por QR para que tus amigos se unan a la partida en la misma red local.

## Qué hace

1. **Historia** (`/story/new` → `/story/[id]`): narración con IA, chat lateral + canvas central con mapa de grilla, TTS por mensaje, estados de jugadores en tiempo real.
2. **Creación de personajes** (`/character/new`): wizard paso a paso (raza, clase, trasfondo, atributos por *standard array*, *point buy* o 4d6, habilidades, detalles). Exporta a PDF en español (`/api/character/[id]/pdf`).
3. **Baúl** (`/`): lista de historias y personajes guardados.
4. **Interacción remota** (`/play/[sessionId]`): vista 100% mobile, accesible por QR con la IP LAN del host. Tabs: Personaje, Acciones, Chat (público/privado), Dados.
5. **Ajustes** (`/settings`): modo de dados por rol (auto/manual), proveedores de IA (chat/imagen/voz) con API keys cifradas, SFX, estado de modelos, re-ingesta del Handbook.

## Proveedores soportados

### Chat / narrativa
- **Ollama** (local, default) — `gemma4:e2b`, `llama3.1`, `qwen2.5`, `mistral`…
- **OpenAI** — `gpt-4o-mini`, `gpt-4o`, `gpt-4.1`, `o4-mini`
- **Anthropic** — `claude-3-5-haiku`, `claude-3-5-sonnet`, `claude-3-7-sonnet`, `claude-opus-4`
- **Google Gemini** — `gemini-2.0-flash`, `gemini-2.5-flash`, `gemini-2.5-pro`
- **OpenRouter** / **Groq** — gateway compatible con OpenAI
- **Custom** — cualquier endpoint OpenAI-compatible (vLLM, LM Studio, LiteLLM…)

### Generación de imágenes (escenas, mapas, retratos)
- **Desactivado** — usa el canvas procedural
- **OpenAI** — `gpt-image-1`, `dall-e-3`
- **Google Imagen** — `imagen-3.0-generate-002`
- **Stability** — `sd3.5-large`, `sd3.5-medium`, `core`

### Voz
- **Piper** (local) — voces `.onnx` en `data/voices/`
- **OpenAI TTS** — `gpt-4o-mini-tts` con voces `alloy`, `coral`, `nova`…
- **ElevenLabs** — `eleven_multilingual_v2`, `eleven_turbo_v2_5`
- **Web Speech API** — voz del SO en el navegador

Las API keys se cifran con AES-256-GCM usando un keyring local (`data/.keyring`). Alternativamente define variables de entorno (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `STABILITY_API_KEY`, `ELEVENLABS_API_KEY`).

## Requisitos

- Node.js ≥ 20
- Ollama corriendo local (`http://localhost:11434`)
  - `ollama pull gemma4:e2b` (modelo principal — ya instalado en este equipo)
  - `ollama pull nomic-embed-text` (embeddings para el RAG)
- (Opcional, recomendado) [Piper TTS](https://github.com/rhasspy/piper) y una voz en español:
  - Descarga el binario desde [releases de Piper](https://github.com/rhasspy/piper/releases) y déjalo en el PATH.
  - Descarga una voz `.onnx` y su `.onnx.json` en `data/voices/`. Ejemplo:
    ```bash
    mkdir -p data/voices && cd data/voices
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx
    curl -LO https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/claude/high/es_MX-claude-high.onnx.json
    ```
  - Si Piper no está disponible, la app usa *Web Speech API* del navegador automáticamente.

## Instalación

```bash
cd /Users/quielo/Personal/dnd
npm install
ollama pull nomic-embed-text          # necesario para RAG con embeddings
npm run ingest:handbook               # indexa Player's Handbook (tarda varios minutos)
npm run dev                           # arranca en puerto 3000 (o usa PORT=3030)
```

Abre `http://localhost:3000`. La URL LAN (para el QR) la calcula el servidor automáticamente.

## Comandos

- `npm run dev` — custom server con Next.js + Socket.IO en `server.ts`.
- `npm run build` — build de producción.
- `npm start` — producción.
- `npm run ingest:handbook [ruta-al-pdf]` — re-indexa el Manual del jugador.

## Variables de entorno

- `OLLAMA_HOST` — por defecto `http://127.0.0.1:11434`
- `DND_MODEL` — por defecto `gemma4:e2b`
- `DND_EMBED_MODEL` — por defecto `nomic-embed-text`
- `PIPER_BIN` — binario de Piper (por defecto `piper`)
- `PIPER_VOICE` — nombre de la voz (por defecto `es_MX-claude-high`)
- `PIPER_VOICES_DIR` — directorio donde viven los `.onnx` (por defecto `./data/voices`)
- `PORT` — por defecto `3000`
- `DND_SECRET` — semilla para cifrar las API keys guardadas; si no se define se genera un secreto aleatorio en `data/.keyring`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `STABILITY_API_KEY`, `ELEVENLABS_API_KEY` — fallback si no guardas la key desde `/settings`

## Arquitectura

- `app/` — rutas Next.js (App Router) y API routes (`/api/...`).
- `server/` — lógica server-only (Ollama, RAG, dados, Piper, prompts del DM, Socket.IO, red LAN).
- `lib/` — motor 5E (cálculos, schema Zod) y DB (better-sqlite3 + sqlite-vec).
- `components/` — UI compartida.
- `scripts/ingest-handbook.ts` — pipeline one-shot de RAG.
- `data/` — SQLite, caches, assets, voces Piper (gitignored).

## Flujo del DM

1. Jugador envía mensaje vía chat o celular → `POST /api/chat` con `{ sessionId, text }`.
2. Servidor arma un snapshot de la sesión (jugadores, HP, resumen), hace *retrieve* sobre el RAG del Handbook (`retrieveRules`), y construye el prompt.
3. Gemma responde en formato `<narrativa>...</narrativa><acciones>{...json...}</acciones>`.
4. El cliente parsea: la narrativa va al chat (leíble con TTS), las acciones actualizan estado (HP, items, tiradas solicitadas, mapa).
5. Socket.IO sincroniza con todos los dispositivos conectados.

## Roadmap corto

- Panel de encuentros para modo asistente (iniciativa, ataques posibles con alcances).
- Biblioteca curada de mapas/tokens en `data/assets/`.
- Mezcla de SFX desde `[sfx:*]` en la narrativa.
- Importar aventura desde PDF del usuario (mismo pipeline que el Handbook).
