"use client";

import { useMemo } from "react";
import { splitExplainSegments } from "@/lib/explainSegments";
import { GlossableText } from "./GlossableText";

interface ExplainBodyProps {
  /** Raw AI 解説 (EXPLAIN) body — plain Japanese-led prose with embedded
   * English words/phrases, no markup contract required from the model.
   * Re-split on every render (splitExplainSegments is a cheap regex scan),
   * so this also works unchanged while `text` is still growing mid-stream. */
  text: string;
  /** Appended as the base classes' extra, not a replacement — mirrors
   * GlossableText's className convention so callers can nudge spacing
   * without restating whitespace-pre-wrap/text size/leading. */
  className?: string;
  /** Rendered as the last inline child, e.g. ReaderView's streaming-cursor
   * span — kept as a prop rather than a sibling so it stays inline right
   * after the last character instead of wrapping onto its own block. */
  trailing?: React.ReactNode;
}

const BASE_CLASS = "whitespace-pre-wrap text-[15px] leading-relaxed";

/**
 * Shared renderer for AI 解説 bodies (ReaderView's live panel and the
 * /history 文章 tab's expanded row). Splits `text` into English/other runs
 * via splitExplainSegments and renders the English runs through
 * GlossableText's "inline" variant, so users can open a GlossCard straight
 * from the explanation prose — not just from the original passage above it.
 */
export function ExplainBody({ text, className, trailing }: ExplainBodyProps) {
  const segments = useMemo(() => splitExplainSegments(text), [text]);

  return (
    <p className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}>
      {segments.map((seg, i) =>
        seg.type === "en" ? (
          <GlossableText key={i} text={seg.text} variant="inline" />
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
      {trailing}
    </p>
  );
}
