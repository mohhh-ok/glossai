"use client";

import { useEffect } from "react";
import { useTts } from "@/lib/useTts";

interface ReadAloudButtonProps {
  /** Full text to synthesize and play — a reader passage or a history
   * entry's quoted original English. Unlike GlossCard's per-word/example
   * speaker buttons, this is long-form text, so synthesis is seconds rather
   * than instant (measured ~1.3–1.5s for a 400–800 char paragraph with the
   * `say` provider) — hence the "生成中…" state below. */
  text: string;
  className?: string;
}

/**
 * Play/stop toggle for reading a full passage aloud via useTts's single
 * shared audio slot. Shared between ReaderView (the passage body) and
 * HistoryView's 文章 tab (the quoted original English), so both surfaces
 * get identical play/stop/loading behavior from one implementation.
 *
 * Stops playback on unmount and whenever `text` changes, so navigating away
 * or switching to a different passage/entry can't leave audio playing for
 * text the user is no longer looking at.
 */
export function ReadAloudButton({ text, className }: ReadAloudButtonProps) {
  const { play, stop, playingText, loadingText, error } = useTts();

  const isPlaying = playingText === text;
  const isLoading = loadingText === text;

  useEffect(() => {
    return () => stop(text);
  }, [text, stop]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => (isPlaying ? stop(text) : play(text))}
        disabled={isLoading}
        aria-label={isPlaying ? "読み上げを停止" : "本文を読み上げ"}
        className={`rounded-full border px-6 py-2.5 text-sm font-bold transition-colors disabled:cursor-wait disabled:opacity-70 ${
          isPlaying
            ? "border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]"
            : "border-[rgba(159,96,115,0.4)] text-[rgb(var(--gray-dark))] hover:border-[var(--accent)] hover:text-[var(--accent)]"
        }`}
      >
        {isLoading ? "生成中…" : isPlaying ? "停止" : "読み上げ"}
      </button>
      {error && (
        <p className="mt-2 text-xs text-[var(--accent-dark)]">{error}</p>
      )}
    </div>
  );
}
