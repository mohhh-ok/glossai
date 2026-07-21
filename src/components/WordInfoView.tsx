"use client";

import { useState } from "react";
import type { WordInfo } from "@/lib/llm/schema";
import { MAX_EXAMPLES_PER_WORD } from "@/lib/mergeExamples";
import { useTts } from "@/lib/useTts";
import { cacheKey, setCachedWordInfo } from "@/lib/wordCache";
import { GlossableText } from "./GlossableText";
import { SegmentedText } from "./SegmentedText";

interface WordInfoViewProps {
  info: WordInfo;
  /**
   * The exact string this entry was originally looked up under (GlossCard's
   * `top.word`, HistoryView's `entry.surface`) — NOT necessarily the same as
   * `info.word`, which the model may have normalized to a root form (see
   * WORD_SYSTEM_PROMPT). "例文をもっと生成" must key both the wordCache
   * write and the POST /api/word/examples request off this, not `info.word`,
   * so it lands on the exact row/cache-entry the user is looking at instead
   * of a differently-keyed one that happens to share a normalized headword.
   */
  surface: string;
  /**
   * When set, clicking an embedded English word/phrase (an example
   * sentence, or an English run inside meaningJa/nuanceJa/etymologyJa)
   * doesn't open its own GlossCard portal — it calls back with the
   * looked-up phrase so the caller (GlossCard) can navigate within the same
   * card instead. Omitted → GlossableText's default self-managed portal
   * behavior, which is what HistoryView's word-tab expansion (WordInfoView
   * shown outside any GlossCard) relies on.
   */
  onLookup?: (phrase: string) => void;
  /** Rendered as a "←" button to the left of the headword; omitted when
   * there's nowhere to go back to (HistoryView, or GlossCard showing its
   * first/only entry). */
  onBack?: () => void;
  /**
   * Called after "例文をもっと生成" successfully persists a merged
   * WordInfo. Required, not optional: WordInfoView is a pure render of the
   * `info` prop — it doesn't keep an internal mirror of it that it'd need to
   * resync on every external change via an effect (that's exactly the
   * derived-state-from-props anti-pattern react-hooks/set-state-in-effect
   * flags) — so this callback flowing the merged WordInfo back into
   * whatever state the caller owns (GlossCard's nav-stack entry,
   * HistoryView's list state) is the only way the newly generated examples
   * ever make it back into view.
   */
  onInfoUpdated: (info: WordInfo) => void;
}

/**
 * Renders a word/phrase's full lookup content: headword + IPA + pronunciation,
 * meaning, nuance, etymology, and example sentences with per-line TTS.
 * Shared between GlossCard's popover and the expanded row on /history so the
 * two surfaces can't drift out of sync.
 */
export function WordInfoView({
  info,
  surface,
  onLookup,
  onBack,
  onInfoUpdated,
}: WordInfoViewProps) {
  const { play, playingText, error: ttsError } = useTts();
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const remaining = MAX_EXAMPLES_PER_WORD - info.examples.length;

  async function handleGenerateMore() {
    setIsGeneratingMore(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/word/examples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: surface }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "例文の生成に失敗しました。");
      }
      const updated = (await res.json()) as WordInfo;
      // Single write site for the shared wordCache: whichever surface
      // (GlossCard or HistoryView) triggered this, any GlossCard opened for
      // `surface` afterwards — in this session, even a brand-new one — must
      // see the grown example list instead of the stale cached one.
      setCachedWordInfo(cacheKey(surface), { ...updated, cached: true });
      onInfoUpdated(updated);
    } catch (e) {
      setGenerateError(
        e instanceof Error ? e.message : "例文の生成に失敗しました。"
      );
    } finally {
      setIsGeneratingMore(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="前の単語に戻る"
            className="text-lg leading-none text-[rgb(var(--gray))] hover:text-[var(--accent)]"
          >
            ←
          </button>
        )}
        <p className="font-serif-en text-xl text-[rgb(var(--gray-dark))]">{info.word}</p>
        <p className="text-sm text-[rgb(var(--gray))]">{info.ipa}</p>
        <SpeakerButton
          label={`${info.word} の発音を再生`}
          active={playingText === info.word}
          onClick={() => play(info.word)}
        />
      </div>
      <p className="mt-1 text-xs font-bold text-[rgb(var(--gray))]">{info.partOfSpeech}</p>

      <p className="mt-2 text-[15px]">
        <SegmentedText text={info.meaningJa} onLookup={onLookup} />
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--gray-dark))]">
        <SegmentedText text={info.nuanceJa} onLookup={onLookup} />
      </p>

      <p className="mt-4 text-xs font-bold text-[rgb(var(--gray))]">語源</p>
      <p className="mt-1 text-sm leading-relaxed">
        <SegmentedText text={info.etymologyJa} onLookup={onLookup} />
      </p>

      <p className="mt-4 text-xs font-bold text-[rgb(var(--gray))]">例文</p>
      <ul className="mt-1 space-y-2">
        {info.examples.map((ex, i) => (
          <li key={i}>
            <div className="flex items-start gap-1.5">
              <SpeakerButton
                label="例文の発音を再生"
                active={playingText === ex.en}
                onClick={() => play(ex.en)}
              />
              <GlossableText
                text={ex.en}
                variant="inline"
                className="text-sm leading-snug"
                onLookup={onLookup}
              />
            </div>
            <p className="pl-6 text-sm text-[rgb(var(--gray))]">{ex.ja}</p>
          </li>
        ))}
      </ul>

      {remaining > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={handleGenerateMore}
            disabled={isGeneratingMore}
            className="text-xs font-bold text-[var(--accent)] hover:underline disabled:opacity-50"
          >
            {isGeneratingMore ? "生成中…" : `例文をもっと生成(あと${remaining}個)`}
          </button>
          {generateError && (
            <p className="mt-1 text-xs text-[var(--accent-dark)]">{generateError}</p>
          )}
        </div>
      )}

      {ttsError && (
        <p className="mt-3 text-xs text-[var(--accent-dark)]">{ttsError}</p>
      )}
    </div>
  );
}

export function SpeakerButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[var(--accent)] hover:bg-[rgba(187,85,55,0.12)]"
      }`}
    >
      <SpeakerIcon />
    </button>
  );
}

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden="true"
    >
      <path d="M3 8v4h3l4 3.2V4.8L6 8H3z" />
      <path d="M13 6.5a4.2 4.2 0 0 1 0 7" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M15.3 4.2a7.5 7.5 0 0 1 0 11.6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
