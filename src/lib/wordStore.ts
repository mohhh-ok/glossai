import { getDb } from "./db";
import type { WordInfo } from "./llm/schema";

/** Raw `words` row shape as stored (`info` is still the serialized JSON string). */
interface WordRow {
  id: number;
  key: string;
  surface: string;
  context: string | null;
  info: string;
  provider: string | null;
  model: string | null;
  lookup_count: number;
  created_at: string;
  last_seen_at: string;
}

/** A `words` row with `info` parsed back into a `WordInfo`, as surfaced to callers. */
export interface WordHistoryEntry {
  id: number;
  surface: string;
  key: string;
  info: WordInfo;
  lookup_count: number;
  last_seen_at: string;
  created_at: string;
}

/** Normalizes a clicked surface form into the lookup key: trim + lowercase. */
export function normalizeWordKey(surface: string): string {
  return surface.trim().toLowerCase();
}

export function findWordByKey(key: string): WordRow | undefined {
  return getDb().prepare("SELECT * FROM words WHERE key = ?").get(key) as
    | WordRow
    | undefined;
}

/** Bumps `lookup_count` and `last_seen_at` for a cache hit. */
export function touchWord(id: number, now: string): void {
  getDb()
    .prepare(
      "UPDATE words SET lookup_count = lookup_count + 1, last_seen_at = ? WHERE id = ?"
    )
    .run(now, id);
}

interface WordWriteParams {
  key: string;
  surface: string;
  context: string;
  info: WordInfo;
  provider: string;
  model: string;
}

/**
 * Inserts a freshly generated lookup. Uses INSERT OR IGNORE so that two
 * concurrent first-time lookups of the same key (e.g. two tabs) can't crash
 * on the UNIQUE(key) constraint — the loser's generation is simply not
 * persisted, but its result was already returned to its own caller.
 */
export function insertWord(params: WordWriteParams): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO words
         (key, surface, context, info, provider, model, lookup_count, created_at, last_seen_at)
       VALUES
         (@key, @surface, @context, @info, @provider, @model, 1, @now, @now)`
    )
    .run({
      key: params.key,
      surface: params.surface,
      context: params.context,
      info: JSON.stringify(params.info),
      provider: params.provider,
      model: params.model,
      now,
    });
}

/** Overwrites an existing row for a `force: true` regenerate. */
export function updateWord(id: number, params: WordWriteParams): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE words
       SET surface = @surface, context = @context, info = @info,
           provider = @provider, model = @model, last_seen_at = @now
       WHERE id = @id`
    )
    .run({
      id,
      surface: params.surface,
      context: params.context,
      info: JSON.stringify(params.info),
      provider: params.provider,
      model: params.model,
      now,
    });
}

const HISTORY_LIMIT = 500;

export function listWordHistory(): WordHistoryEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, surface, key, info, lookup_count, last_seen_at, created_at
       FROM words
       ORDER BY last_seen_at DESC
       LIMIT ?`
    )
    .all(HISTORY_LIMIT) as WordRow[];

  return rows.map((row) => ({
    id: row.id,
    surface: row.surface,
    key: row.key,
    info: JSON.parse(row.info) as WordInfo,
    lookup_count: row.lookup_count,
    last_seen_at: row.last_seen_at,
    created_at: row.created_at,
  }));
}

/** Returns true if a row was deleted. */
export function deleteWord(id: number): boolean {
  const result = getDb().prepare("DELETE FROM words WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Fields of a WordHistoryEntry the client can hand back for an undo — i.e.
 * everything /api/history's GET response actually exposes. */
export interface WordRestoreParams {
  surface: string;
  info: WordInfo;
  lookup_count: number;
  created_at: string;
  last_seen_at: string;
}

/**
 * Re-inserts a word entry the client optimistically deleted and then asked
 * to undo. `key` is always recomputed from `surface` via normalizeWordKey
 * rather than trusted from the client, so restore can't ever derive the key
 * differently than every other write path does.
 *
 * `context`/`provider`/`model` come back NULL: /api/history's GET response
 * never sends them to the client (see WordHistoryEntry), so there is
 * nothing to restore them from — the alternative would be silently keeping
 * a stale value, which is worse than an honest NULL.
 *
 * Uses INSERT OR REPLACE on the UNIQUE(key) constraint: if a fresh lookup
 * for the same word happened after the delete but before the undo, that
 * newer row is replaced by the restored one, per spec.
 */
export function restoreWord(params: WordRestoreParams): void {
  const key = normalizeWordKey(params.surface);
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO words
         (key, surface, context, info, provider, model, lookup_count, created_at, last_seen_at)
       VALUES
         (@key, @surface, NULL, @info, NULL, NULL, @lookup_count, @created_at, @last_seen_at)`
    )
    .run({
      key,
      surface: params.surface,
      info: JSON.stringify(params.info),
      lookup_count: params.lookup_count,
      created_at: params.created_at,
      last_seen_at: params.last_seen_at,
    });
}
