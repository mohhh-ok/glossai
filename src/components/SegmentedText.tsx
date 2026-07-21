"use client";

import { useMemo } from "react";
import { splitExplainSegments } from "@/lib/explainSegments";
import { useTts } from "@/lib/useTts";
import { GlossableText } from "./GlossableText";
import { SpeakerButton } from "./WordInfoView";

interface SegmentedTextProps {
  /** Mixed Japanese-led prose with embedded English words/phrases — split
   * via splitExplainSegments's English-island rule (see that module's
   * doc-comment for the exact definition of an "island"). */
  text: string;
  /** Forwarded verbatim to every English run's GlossableText — see
   * GlossableText's `onLookup` doc for the delegated-vs-self-managed
   * distinction. */
  onLookup?: (phrase: string, anchor: { x: number; y: number }) => void;
}

// 3語以上の英語の連なり(引用文・イディオム等)にだけスピーカーを付ける。
// 1〜2語の島(「It is」や単語1語)にまで付けると本文がアイコンだらけになり、
// 単語は既にクリック→カード内スピーカーで再生できるため。
const SPEAKER_MIN_WORDS = 3;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Renders `text` as alternating plain spans (Japanese/punctuation/etc.) and
 * clickable English runs (GlossableText's "inline" variant). Shared by
 * ExplainBody (AI 解説 bodies) and WordInfoView (meaningJa/nuanceJa/
 * etymologyJa) so both mixed-language surfaces can't drift out of sync.
 */
export function SegmentedText({ text, onLookup }: SegmentedTextProps) {
  const segments = useMemo(() => splitExplainSegments(text), [text]);
  const { play, playingText } = useTts();

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "en" ? (
          // 島本体は包まず通常のインラインフローに置く(長い引用文が行内で
          // 自然に折り返せるように)。スピーカーだけを島の直後にinline-flexで置く
          <span key={i}>
            <GlossableText text={seg.text} variant="inline" onLookup={onLookup} />
            {wordCount(seg.text) >= SPEAKER_MIN_WORDS && (
              <span className="ml-1 inline-flex translate-y-0.5">
                <SpeakerButton
                  label={`「${seg.text}」を読み上げ`}
                  active={playingText === seg.text}
                  onClick={(e) => {
                    e.stopPropagation();
                    play(seg.text);
                  }}
                />
              </span>
            )}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
