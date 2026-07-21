"use client";

import type { WordInfo } from "@/lib/llm/schema";
import { useTts } from "@/lib/useTts";
import { GlossableText } from "./GlossableText";
import { SegmentedText } from "./SegmentedText";

interface WordInfoViewProps {
  info: WordInfo;
  /**
   * Context `info.word` was itself looked up under. Used as the fetch
   * context when a click inside meaningJa/nuanceJa/etymologyJa (prose
   * *about* info.word, not about the clicked run) triggers a lookup — only
   * meaningful when `onLookup` is also passed.
   */
  context?: string;
  /**
   * When set, clicking an embedded English word/phrase (an example
   * sentence, or an English run inside meaningJa/nuanceJa/etymologyJa)
   * doesn't open its own GlossCard portal — it calls back with
   * (phrase, context) so the caller (GlossCard) can navigate within the same
   * card instead. Examples pass their own sentence as context; meaning/
   * nuance/etymology runs pass `context` (info.word's own lookup context).
   * Omitted → GlossableText's default self-managed portal behavior, which
   * is what HistoryView's word-tab expansion (WordInfoView shown outside
   * any GlossCard) relies on.
   */
  onLookup?: (phrase: string, context: string) => void;
  /** Rendered as a "←" button to the left of the headword; omitted when
   * there's nowhere to go back to (HistoryView, or GlossCard showing its
   * first/only entry). */
  onBack?: () => void;
}

/**
 * Renders a word/phrase's full lookup content: headword + IPA + pronunciation,
 * meaning, nuance, etymology, and example sentences with per-line TTS.
 * Shared between GlossCard's popover and the expanded row on /history so the
 * two surfaces can't drift out of sync.
 */
export function WordInfoView({ info, context, onLookup, onBack }: WordInfoViewProps) {
  const { play, playingText, error: ttsError } = useTts();

  // meaningJa/nuanceJa/etymologyJa are *about* info.word, so a lookup
  // triggered from inside them should use info.word's own context, not the
  // clicked run's text — hence binding `context` here rather than letting
  // SegmentedText/GlossableText supply their own text as context.
  const fieldLookup =
    onLookup && context !== undefined
      ? (phrase: string) => onLookup(phrase, context)
      : undefined;

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
        <SegmentedText text={info.meaningJa} onLookup={fieldLookup} />
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--gray-dark))]">
        <SegmentedText text={info.nuanceJa} onLookup={fieldLookup} />
      </p>

      <p className="mt-4 text-xs font-bold text-[rgb(var(--gray))]">語源</p>
      <p className="mt-1 text-sm leading-relaxed">
        <SegmentedText text={info.etymologyJa} onLookup={fieldLookup} />
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
                onLookup={onLookup ? (phrase) => onLookup(phrase, ex.en) : undefined}
              />
            </div>
            <p className="pl-6 text-sm text-[rgb(var(--gray))]">{ex.ja}</p>
          </li>
        ))}
      </ul>

      {ttsError && (
        <p className="mt-3 text-xs text-[var(--accent-dark)]">{ttsError}</p>
      )}
    </div>
  );
}

function SpeakerButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
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
