"use client";

import { SegmentedText } from "./SegmentedText";

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
 * via SegmentedText and renders the English runs through GlossableText's
 * "inline" variant, so users can open a GlossCard straight from the
 * explanation prose — not just from the original passage above it.
 */
export function ExplainBody({ text, className, trailing }: ExplainBodyProps) {
  return (
    <p className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}>
      <SegmentedText text={text} />
      {trailing}
    </p>
  );
}
