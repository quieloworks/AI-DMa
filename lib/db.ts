import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "dnd.db");

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  try {
    sqliteVec.load(db);
  } catch (err) {
    console.warn("sqlite-vec no pudo cargarse; la búsqueda vectorial usará fallback:", err);
  }

  migrate(db);
  _db = db;
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handbook_chunk (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section TEXT NOT NULL,
      subsection TEXT,
      page INTEGER,
      text TEXT NOT NULL,
      tokens INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_hc_section ON handbook_chunk(section);

    CREATE VIRTUAL TABLE IF NOT EXISTS handbook_fts USING fts5(
      section, subsection, text,
      content='handbook_chunk', content_rowid='id',
      tokenize='unicode61'
    );

    CREATE TABLE IF NOT EXISTS character (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      owner TEXT NOT NULL DEFAULT 'local',
      level INTEGER NOT NULL DEFAULT 1,
      class TEXT,
      race TEXT,
      background TEXT,
      portrait TEXT,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'auto',
      source_pdf TEXT,
      summary TEXT,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      story_id TEXT NOT NULL,
      state_json TEXT NOT NULL,
      turn INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(story_id) REFERENCES story(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_player (
      session_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      token TEXT NOT NULL,
      connected INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (session_id, player_id),
      FOREIGN KEY(session_id) REFERENCES session(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS session_message (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      player_id TEXT,
      kind TEXT NOT NULL DEFAULT 'public',
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(session_id) REFERENCES session(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS asset (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      title TEXT,
      path TEXT NOT NULL,
      tags TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS api_key (
      provider TEXT PRIMARY KEY,
      encrypted TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  try {
    db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS handbook_vec USING vec0(
      embedding float[768]
    );`);
  } catch {
    // sqlite-vec no disponible; RAG usará solo FTS
  }
}

export function setMeta(key: string, value: string) {
  getDb()
    .prepare(`INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)`)
    .run(key, value);
}

export function getMeta(key: string): string | null {
  const row = getDb()
    .prepare<string, { value: string }>(`SELECT value FROM meta WHERE key = ?`)
    .get(key);
  return row?.value ?? null;
}

export function setSetting<T>(key: string, value: T) {
  getDb()
    .prepare(`INSERT OR REPLACE INTO settings(key, value) VALUES (?, ?)`)
    .run(key, JSON.stringify(value));
}

export function getSetting<T>(key: string, fallback: T): T {
  const row = getDb()
    .prepare<string, { value: string }>(`SELECT value FROM settings WHERE key = ?`)
    .get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}
