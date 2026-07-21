"use client";

import { useMemo } from "react";
import { splitExplainSegments } from "@/lib/explainSegments";
import { GlossableText } from "./GlossableText";

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

/**
 * Renders `text` as alternating plain spans (Japanese/punctuation/etc.) and
 * clickable English runs (GlossableText's "inline" variant). Shared by
 * ExplainBody (AI 解説 bodies) and WordInfoView (meaningJa/nuanceJa/
 * etymologyJa) so both mixed-language surfaces can't drift out of sync.
 */
export function SegmentedText({ text, onLookup }: SegmentedTextProps) {
  const segments = useMemo(() => splitExplainSegments(text), [text]);

  return (
    <>
      {segments.map((seg, i) =>
        seg.type === "en" ? (
          <GlossableText key={i} text={seg.text} variant="inline" onLookup={onLookup} />
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </>
  );
}
