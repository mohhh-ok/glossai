"use client";

import type { WordInfo } from "@/lib/llm/schema";
import { useTts } from "@/lib/useTts";

interface WordInfoViewProps {
  info: WordInfo;
}

/**
 * Renders a word/phrase's full lookup content: headword + IPA + pronunciation,
 * meaning, nuance, etymology, and example sentences with per-line TTS.
 * Shared between GlossCard's popover and the expanded row on /history so the
 * two surfaces can't drift out of sync.
 */
export function WordInfoView({ info }: WordInfoViewProps) {
  const { play, playingText, error: ttsError } = useTts();

  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="font-serif-en text-xl text-[rgb(var(--gray-dark))]">{info.word}</p>
        <p className="text-sm text-[rgb(var(--gray))]">{info.ipa}</p>
        <SpeakerButton
          label={`${info.word} の発音を再生`}
          active={playingText === info.word}
          onClick={() => play(info.word)}
        />
      </div>
      <p className="mt-1 text-xs font-bold text-[rgb(var(--gray))]">{info.partOfSpeech}</p>

      <p className="mt-2 text-[15px]">{info.meaningJa}</p>
      <p className="mt-2 text-sm leading-relaxed text-[rgb(var(--gray-dark))]">
        {info.nuanceJa}
      </p>

      <p className="mt-4 text-xs font-bold text-[rgb(var(--gray))]">語源</p>
      <p className="mt-1 text-sm leading-relaxed">{info.etymologyJa}</p>

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
              <span className="font-serif-en text-sm leading-snug">{ex.en}</span>
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
