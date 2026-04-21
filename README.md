# Mesa — The AI Dungeon Master

> A fullstack, local-first **AI tabletop platform** for Dungeons & Dragons 5E. Your Dungeon Master is a language model. Your narrator uses local or cloud TTS. Your scenes are generated on demand. Your friends join from their phones by scanning a QR code.

Mesa runs an end-to-end AI stack — **LLM + RAG + TTS + image generation** — orchestrated around a real D&D 5E rules engine, so the magic feels like a real game table, not a chatbot.

---

## Why this is different

Most AI D&D tools are thin wrappers over ChatGPT. Mesa is the opposite: a real game client with a real rules engine, where AI is a first-class citizen at every layer.

- **Local-first by design.** Runs entirely on your machine with Ollama + system TTS (`say` on macOS, `espeak-ng` on Linux). Zero API keys required to play.
- **Bring-your-own-provider.** Plug in OpenAI, Anthropic, Gemini, OpenRouter, Groq, xAI Grok, Stability, or ElevenLabs from an in-app settings panel. Keys are encrypted at rest with **AES-256-GCM**.
- **Grounded in the rules.** A built-in **RAG pipeline over the Player's Handbook** (SQLite + `sqlite-vec` + `nomic-embed-text`) means the DM cites actual mechanics, not hallucinated ones.
- **Multi-device out of the box.** Scan a QR, join from your phone over LAN. Realtime sync via Socket.IO.
- **Structured AI output.** The DM answers in a parsed `<narrative>` + `<actions>` contract that directly mutates game state — HP, inventory, dice requests, map updates — no brittle prompt parsing tricks.

---

## The AI stack

### Narrative engine — your Dungeon Master
A language model drives the fiction, interprets player intent, and emits game-state actions.

| Provider | Models |
|---|---|
| **Ollama** (local, default) | `gemma4:e2b`, `llama3.1`, `qwen2.5`, `mistral`, any model you pull |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `gpt-4.1`, `o4-mini` |
| **Anthropic** | `claude-opus-4`, `claude-3.7-sonnet`, `claude-3.5-sonnet`, `claude-3.5-haiku` |
| **Google Gemini** | `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash` |
| **OpenRouter / Groq** | any OpenAI-compatible model on the gateway |
| **xAI Grok** | `grok-4-1-fast-reasoning` (default), same API for chat and Imagine images |
| **Custom endpoint** | vLLM, LM Studio, LiteLLM, anything OpenAI-shaped |

### Retrieval-Augmented Generation (RAG)
`scripts/ingest-handbook.ts` chunks, embeds and indexes the **Player's Handbook** into a vector store built on **SQLite + sqlite-vec**. Before every DM response, `retrieveRules()` pulls the top-k relevant passages so answers stay canonical.

### Image generation — living scenes
Generate maps, tokens, portraits and scene backdrops on the fly.

- **OpenAI** — `gpt-image-1`, `dall-e-3`
- **Google Imagen** — `imagen-3.0-generate-002`
- **Stability** — `sd3.5-large`, `sd3.5-medium`, `core`
- **xAI Grok Imagine** — `grok-imagine-image`, `grok-imagine-image-pro`
- **Disabled** — falls back to a procedural canvas with fog-of-war + grid

### Voice & narration (TTS)
Every narrative message is speakable, per-message, per-voice.

- **System TTS** *(local, no network, no API tokens)* — macOS **`say`** (output converted to WAV with **`afconvert`**); Linux **`espeak-ng`**. Default Spanish voice on Mac: `Paulina` (`es-mx`). List macOS voices with `say -v '?'`.
- **OpenAI TTS** — `gpt-4o-mini-tts` with `alloy`, `coral`, `nova`, …
- **ElevenLabs** — `eleven_multilingual_v2`, `eleven_turbo_v2_5`
- **Web Speech API** — zero-setup fallback using the OS voice

---

## Features

1. **`/story/new` → `/story/[id]` — Live session.** AI narrator, side chat, central canvas with grid map, per-message TTS, realtime player state. Optionally **upload an adventure PDF** — it is ingested into a per-story RAG index, summarized into an outline, and used by the DM as the canonical source of truth (the DM only improvises where the module is silent).
2. **`/character/new` — Character builder.** Step-by-step wizard: race, class, background, ability scores (standard array / point buy / 4d6), skills, details. Export to a fillable **Spanish PDF sheet** via `GET /api/character/[id]/pdf`.
3. **`/` — The Vault.** All your stories and characters in one place.
4. **`/play/[sessionId]` — Mobile companion.** Phone-optimized view joined via QR on the host's LAN. Tabs: Character, Actions, Chat (public/private), Dice.
5. **`/settings` — Control room.** Per-role provider selection (chat / image / voice), encrypted API keys, dice mode per seat (auto/manual), SFX, model health, handbook re-ingest button.

---

## How the DM turn works

```
Player message
   ↓
POST /api/chat  { sessionId, text }
   ↓
Server snapshots the session (players, HP, summary)
   ↓
RAG: retrieveRules(text)  →  top-k chunks from the Handbook
   ↓
Prompt assembled → LLM (Ollama / OpenAI / Anthropic / …)
   ↓
Model returns:
   <narrative> … </narrative>
   <actions>   { …json… } </actions>
   ↓
Narrative → chat (streamed to TTS if enabled)
Actions   → mutate game state (HP, items, dice requests, map)
   ↓
Socket.IO fan-out → every connected device
```

To trim **LLM input tokens** per DM turn (env knobs and measurement script), see [docs/llm-token-reduction-runbook.md](docs/llm-token-reduction-runbook.md).

---

## Requirements

- **Node.js ≥ 20**
- **[Ollama](https://ollama.com)** running locally at `http://localhost:11434`
  - `ollama pull gemma4:e2b` — default narrator model
  - `ollama pull nomic-embed-text` — embeddings for RAG
- **TTS local (sin instalación extra en macOS):** el narrador usa el binario **`/usr/bin/say`** y **`afconvert`**, incluidos en el sistema. En **Linux**, instala `espeak-ng` (`apt install espeak-ng` o `brew install espeak-ng`). Si el servidor no puede sintetizar audio, el cliente usa la **Web Speech API** del navegador.

---

## Install & run

```bash
cd /Users/quielo/Personal/dnd
npm install
ollama pull nomic-embed-text      # embeddings for RAG
npm run ingest:handbook           # indexes the Player's Handbook (takes several minutes)
npm run dev                       # http://localhost:3000  (override with PORT=3030)
```

The LAN URL used for the mobile QR is auto-detected by the server.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Custom Next.js + Socket.IO server (`server.ts`) |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run ingest:handbook [path-to-pdf]` | Re-index the Player's Handbook |

---

## Environment variables

| Variable | Default / purpose |
|---|---|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` |
| `DND_MODEL` | `gemma4:e2b` |
| `DND_EMBED_MODEL` | `nomic-embed-text` |
| `SYSTEM_TTS_VOICE` | (opcional) Nombre de voz por defecto para `say` / `espeak-ng` si no configuras otra en ajustes |
| `PORT` | `3000` |
| `DND_SECRET` | Seed to encrypt stored API keys. If unset, a random secret is generated at `data/.keyring` |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `XAI_API_KEY`, `STABILITY_API_KEY`, `ELEVENLABS_API_KEY` | Fallbacks if you don't store the key via `/settings` |

> API keys entered in the UI are encrypted with **AES-256-GCM** using a local keyring (`data/.keyring`). They never leave the machine.

---

## Architecture

```
app/          Next.js App Router — pages + API routes (/api/…)
server/       Server-only logic — Ollama, RAG, dice, system TTS, DM prompts, Socket.IO, LAN
lib/          5E engine (rules, Zod schemas) + DB (better-sqlite3 + sqlite-vec)
components/   Shared UI
scripts/      one-shot RAG ingest pipeline
data/         SQLite, caches, assets (gitignored)
```

**Key tech:** Next.js 14 · TypeScript · Socket.IO · Tailwind · Framer Motion · better-sqlite3 · sqlite-vec · Ollama · system TTS · pdf-lib · Zod.

---

## Roadmap

- Encounter panel for assistant mode (initiative tracker, reachable attacks per tile).
- Curated map/token library under `data/assets/`.
- Inline SFX mixing via `[sfx:*]` tags in the narrative stream.

---

*Roll for initiative.*
