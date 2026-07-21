import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Singleton better-sqlite3 connection, lazily opened on first use so that
 * importing this module (e.g. transitively, at build time) never touches the
 * filesystem. Path is configurable via `GLOSSAI_DB` (relative paths resolve
 * against process.cwd(), i.e. the project root under `next dev`/`next start`)
 * so operators can point it at a different volume without code changes.
 */
let db: Database.Database | null = null;

function resolveDbPath(): string {
  return process.env.GLOSSAI_DB || "data/glossai.db";
}

function createSchema(instance: Database.Database): void {
  instance.exec(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      surface TEXT NOT NULL,
      context TEXT,
      info TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      lookup_count INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS explains (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_hash TEXT NOT NULL UNIQUE,
      text TEXT NOT NULL,
      body TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

/** Returns the shared DB connection, opening (and migrating) it on first call. */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();
  // dbPath comes from an env var, so Turbopack's file tracer can't statically
  // scope it and defensively traces the whole project instead — silence that
  // with an explicit ignore rather than let the build warn every time.
  mkdirSync(dirname(resolve(/* turbopackIgnore: true */ dbPath)), {
    recursive: true,
  });

  const instance = new Database(dbPath);
  instance.pragma("journal_mode = WAL");
  createSchema(instance);

  db = instance;
  return db;
}
