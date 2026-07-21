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
