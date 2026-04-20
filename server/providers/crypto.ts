import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const KEYRING_PATH = join(DATA_DIR, ".keyring");

function getMasterKey(): Buffer {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const envKey = process.env.DND_SECRET;
  const material = envKey ?? readOrCreateLocalSecret();
  return scryptSync(material, "dnd-keyring-salt-v1", 32);
}

function readOrCreateLocalSecret(): string {
  if (existsSync(KEYRING_PATH)) {
    return readFileSync(KEYRING_PATH, "utf8").trim();
  }
  const secret = randomBytes(32).toString("hex");
  writeFileSync(KEYRING_PATH, secret, "utf8");
  try {
    chmodSync(KEYRING_PATH, 0o600);
  } catch {
    // no-op on systems that don't support chmod
  }
  return secret;
}

export function encryptString(plain: string): string {
  const key = getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptString(payload: string): string {
  const [version, ivB64, tagB64, encB64] = payload.split(":");
  if (version !== "v1") throw new Error("formato de cifrado desconocido");
  const key = getMasterKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}

export function maskKey(key: string | null | undefined): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return `${key.slice(0, 3)}••••${key.slice(-4)}`;
}
