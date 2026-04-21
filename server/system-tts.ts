import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(execFileCb);
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Voz por defecto: macOS `say` (nombre corto, ver `say -v '?'`). */
const DEFAULT_VOICE_DARWIN = process.env.SYSTEM_TTS_VOICE ?? "Paulina";
/** espeak-ng voice id (p. ej. es-mx, es). */
const DEFAULT_VOICE_ESPEAK = process.env.SYSTEM_TTS_VOICE ?? "es-mx";

export type SystemTtsOptions = {
  voice?: string;
  /** Palabras por minuto (aprox.). */
  rate?: number;
};

export type SystemTtsAvailability = {
  ok: boolean;
  engine: "say" | "espeak" | null;
  voice: string;
  detail?: string;
};

export async function checkSystemTts(): Promise<SystemTtsAvailability> {
  if (process.platform === "darwin") {
    if (!existsSync("/usr/bin/say")) {
      return { ok: false, engine: null, voice: DEFAULT_VOICE_DARWIN, detail: "say no encontrado" };
    }
    return { ok: true, engine: "say", voice: DEFAULT_VOICE_DARWIN };
  }
  try {
    await execFile("espeak-ng", ["--version"], { timeout: 5000 });
    return { ok: true, engine: "espeak", voice: DEFAULT_VOICE_ESPEAK };
  } catch {
    return {
      ok: false,
      engine: null,
      voice: DEFAULT_VOICE_ESPEAK,
      detail: "Instala espeak-ng (p. ej. apt install espeak-ng o brew install espeak-ng)",
    };
  }
}

/** Convierte nombres de voz heredados de Piper / .onnx al esquema del sistema. */
export function resolveSystemVoice(configured: string | undefined): string {
  const v = configured?.trim();
  if (!v || v === "es_MX-claude-high" || v.endsWith(".onnx")) {
    return process.platform === "darwin" ? DEFAULT_VOICE_DARWIN : DEFAULT_VOICE_ESPEAK;
  }
  if (process.platform !== "darwin") {
    // Nombres de `say` (p. ej. Paulina) no son ids de espeak-ng
    if (/^[A-Z][a-z]+$/.test(v)) {
      return DEFAULT_VOICE_ESPEAK;
    }
  }
  return v;
}

export async function synthesizeToWav(text: string, opts: SystemTtsOptions = {}): Promise<Buffer> {
  const status = await checkSystemTts();
  if (!status.ok || !status.engine) {
    throw new Error(status.detail ?? "tts-no-disponible");
  }
  const voice = resolveSystemVoice(opts.voice);
  const rate = opts.rate ?? 170;
  if (status.engine === "say") {
    return synthesizeDarwin(text, voice, rate);
  }
  return synthesizeEspeak(text, voice, rate);
}

async function synthesizeDarwin(text: string, voice: string, rate: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "dnd-tts-"));
  try {
    const inputPath = join(dir, "in.txt");
    const aiffPath = join(dir, "out.aiff");
    const wavPath = join(dir, "out.wav");
    await writeFile(inputPath, text, "utf8");
    await execFile("/usr/bin/say", ["-v", voice, "-r", String(rate), "-f", inputPath, "-o", aiffPath], {
      timeout: 120_000,
    });
    await execFile("/usr/bin/afconvert", ["-f", "WAVE", "-d", "LEI16", aiffPath, wavPath], { timeout: 60_000 });
    return await readFile(wavPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function synthesizeEspeak(text: string, voice: string, rate: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "dnd-tts-"));
  try {
    const wavPath = join(dir, "out.wav");
    await execFile("espeak-ng", ["-v", voice, "-s", String(rate), "-w", wavPath, text], { timeout: 120_000 });
    return await readFile(wavPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Ritmo según emoción (palabras/minuto aprox.). */
export function emotionToSpeakingRate(emotion?: string): number {
  switch (emotion) {
    case "epic":
    case "epica":
      return 155;
    case "suspense":
    case "suspenso":
      return 135;
    case "calmo":
    case "calm":
      return 165;
    case "urgente":
    case "urgent":
      return 195;
    default:
      return 170;
  }
}
