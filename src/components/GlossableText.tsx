"use client";

import { useMemo, useState } from "react";
import { tokenize } from "@/lib/tokenize";
import { GlossCard } from "./GlossCard";

export type GlossableTextVariant = "reader" | "quote";

interface GlossableTextProps {
  /** The English passage to render. Also used as GlossCard's lookup context. */
  text: string;
  /**
   * Visual preset. "reader" is the large serif reading layout used by
   * ReaderView; "quote" is the smaller inset blockquote look used for the
   * excerpt shown in /history. Defaults to "reader".
   */
  variant?: GlossableTextVariant;
  /**
   * Extra classes appended to the variant's base classes (not a replacement)
   * so callers can nudge spacing/layout without having to restate the whole
   * visual preset — keeps GlossableText the single source of truth for what
   * "reader" and "quote" look like.
   */
  className?: string;
}

interface GlossTarget {
  phrase: string;
  anchor: { x: number; y: number };
}

const VARIANT_TAG: Record<GlossableTextVariant, "p" | "blockquote"> = {
  reader: "p",
  quote: "blockquote",
};

const VARIANT_CLASSES: Record<GlossableTextVariant, string> = {
  reader:
    "font-serif-en select-text text-[1.15rem] leading-[1.9] text-[rgb(var(--gray-dark))]",
  quote:
    "font-serif-en select-text rounded-md bg-[rgb(242,240,238)] p-3 text-[14px] leading-relaxed text-[rgb(var(--gray-dark))]",
};

/**
 * Tokenizes `text` into clickable words and renders the open GlossCard
 * popover for whichever word or drag-selected phrase (2–6 words) was last
 * targeted. Shared between ReaderView's main passage and the history page's
 * expanded original-text excerpt so both surfaces can look word-lookup
 * behavior from a single implementation.
 */
export function GlossableText({
  text,
  variant = "reader",
  className,
}: GlossableTextProps) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [gloss, setGloss] = useState<GlossTarget | null>(null);

  function openGloss(phrase: string, x: number, y: number) {
    setGloss({ phrase, anchor: { x, y } });
  }

  function handleWordClick(word: string, e: React.MouseEvent) {
    // If a drag-selection just produced a non-empty selection, the
    // mouseup handler below already opened (or will open) a phrase card —
    // don't also open a single-word card for the same gesture.
    const selected = window.getSelection()?.toString().trim();
    if (selected) return;
    openGloss(word, e.clientX, e.clientY);
  }

  function handleMouseUp(e: React.MouseEvent) {
    const selection = window.getSelection();
    const selected = selection?.toString().trim() ?? "";
    if (!selected) return;

    const wordCount = selected.split(/\s+/).filter(Boolean).length;
    if (wordCount < 2 || wordCount > 6) return;

    openGloss(selected, e.clientX, e.clientY);
  }

  const Tag = VARIANT_TAG[variant];
  const baseClass = VARIANT_CLASSES[variant];

  return (
    <>
      <Tag
        onMouseUp={handleMouseUp}
        className={className ? `${baseClass} ${className}` : baseClass}
      >
        {tokens.map((token, i) =>
          token.type === "word" ? (
            <span
              key={i}
              onClick={(e) => handleWordClick(token.value, e)}
              className="cursor-pointer border-b border-dotted border-transparent transition-colors hover:border-[rgb(var(--gray))]"
            >
              {token.value}
            </span>
          ) : (
            <span key={i}>{token.value}</span>
          )
        )}
      </Tag>

      {gloss && (
        <GlossCard
          // Force a fresh mount per lookup target so GlossCard's lazy
          // cache-hit state initializer always runs against the right key.
          key={`${gloss.phrase}-${gloss.anchor.x}-${gloss.anchor.y}`}
          word={gloss.phrase}
          context={text}
          anchor={gloss.anchor}
          onClose={() => setGloss(null)}
        />
      )}
    </>
  );
}
