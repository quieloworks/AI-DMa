import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";

const PIPER_BIN = process.env.PIPER_BIN ?? "piper";
const DEFAULT_VOICE = process.env.PIPER_VOICE ?? "es_MX-claude-high";
const VOICES_DIR = process.env.PIPER_VOICES_DIR ?? join(process.cwd(), "data/voices");

if (!existsSync(VOICES_DIR)) mkdirSync(VOICES_DIR, { recursive: true });

export type PiperOptions = {
  voice?: string;
  lengthScale?: number;
  noiseScale?: number;
  noiseW?: number;
};

export type PiperAvailability = { installed: boolean; voice: string; voicePath: string | null; error?: string };

export async function checkPiper(): Promise<PiperAvailability> {
  const voice = DEFAULT_VOICE;
  const voicePath = join(VOICES_DIR, `${voice}.onnx`);
  const installed = await commandExists(PIPER_BIN);
  return { installed, voice, voicePath: existsSync(voicePath) ? voicePath : null, error: installed ? undefined : "piper no encontrado" };
}

function commandExists(cmd: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd, ["--help"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", () => resolve(true));
  });
}

export function synthesize(text: string, opts: PiperOptions = {}): Readable {
  const voice = opts.voice ?? DEFAULT_VOICE;
  const voicePath = join(VOICES_DIR, `${voice}.onnx`);
  const args = ["--model", voicePath, "--output_raw"];
  if (opts.lengthScale) args.push("--length-scale", String(opts.lengthScale));
  if (opts.noiseScale) args.push("--noise-scale", String(opts.noiseScale));
  if (opts.noiseW) args.push("--noise-w", String(opts.noiseW));

  const child = spawn(PIPER_BIN, args, { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.write(text);
  child.stdin.end();
  child.stderr.on("data", (d) => console.error("[piper]", d.toString()));
  return child.stdout;
}

export function emotionToParams(emotion?: string): PiperOptions {
  switch (emotion) {
    case "epic":
    case "epica":
      return { lengthScale: 1.1, noiseScale: 0.75 };
    case "suspense":
    case "suspenso":
      return { lengthScale: 1.25, noiseScale: 0.55 };
    case "calmo":
    case "calm":
      return { lengthScale: 1.15, noiseScale: 0.5 };
    case "urgente":
    case "urgent":
      return { lengthScale: 0.9, noiseScale: 0.8 };
    default:
      return { lengthScale: 1.05, noiseScale: 0.667 };
  }
}
