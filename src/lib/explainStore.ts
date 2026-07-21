import { createHash } from "node:crypto";
import { getDb } from "./db";

/** sha256 of the source text, used as the cache key for /api/explain. */
export function hashExplainText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

interface ExplainRow {
  id: number;
  text_hash: string;
  text: string;
  body: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

export function findExplainByHash(hash: string): ExplainRow | undefined {
  return getDb()
    .prepare("SELECT * FROM explains WHERE text_hash = ?")
    .get(hash) as ExplainRow | undefined;
}

/** An `explains` row as surfaced to the `/history` page (no `text_hash`). */
export interface ExplainHistoryEntry {
  id: number;
  text: string;
  body: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

const EXPLAIN_HISTORY_LIMIT = 200;

export function listExplains(limit = EXPLAIN_HISTORY_LIMIT): ExplainHistoryEntry[] {
  return getDb()
    .prepare(
      `SELECT id, text, body, provider, model, created_at
       FROM explains
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as ExplainHistoryEntry[];
}

/** Returns true if a row was deleted. */
export function deleteExplain(id: number): boolean {
  const result = getDb().prepare("DELETE FROM explains WHERE id = ?").run(id);
  return result.changes > 0;
}

/** Fields of an ExplainHistoryEntry the client can hand back for an undo —
 * i.e. everything /api/history's GET response actually exposes. */
export interface ExplainRestoreParams {
  text: string;
  body: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

/**
 * Re-inserts an explain entry the client optimistically deleted and then
 * asked to undo. `text_hash` is always recomputed from `text` via
 * hashExplainText rather than trusted from the client (the client never even
 * has it — /api/history's GET response omits it), so restore derives the
 * hash the same way every other write path does.
 *
 * Uses INSERT OR REPLACE on the UNIQUE(text_hash) constraint: if the same
 * text was explained again after the delete but before the undo, that newer
 * row is replaced by the restored one, per spec.
 */
export function restoreExplain(params: ExplainRestoreParams): void {
  const hash = hashExplainText(params.text);
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO explains (text_hash, text, body, provider, model, created_at)
       VALUES (@hash, @text, @body, @provider, @model, @created_at)`
    )
    .run({ hash, ...params });
}

/**
 * Persists a completed explanation. Uses INSERT OR IGNORE for the same
 * reason as wordStore.insertWord: two concurrent first-time requests for the
 * identical text must not crash on the UNIQUE(text_hash) constraint.
 */
export function insertExplain(params: {
  hash: string;
  text: string;
  body: string;
  provider: string;
  model: string;
}): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT OR IGNORE INTO explains (text_hash, text, body, provider, model, created_at)
       VALUES (@hash, @text, @body, @provider, @model, @now)`
    )
    .run({ ...params, now });
}
