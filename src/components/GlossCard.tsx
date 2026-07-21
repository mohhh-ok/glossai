"use client";

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import { glossNavReducer } from "@/lib/glossNavStack";
import { useMediaQuery } from "@/lib/useMediaQuery";
import {
  cacheKey,
  getCachedWordInfo,
  setCachedWordInfo,
  type WordLookupResult,
} from "@/lib/wordCache";
import { WordInfoView } from "./WordInfoView";

interface GlossCardProps {
  word: string;
  anchor: { x: number; y: number };
  onClose: () => void;
}

// Below this viewport width, GlossCard gives up on being a popover (there's
// no good anchor-relative spot for a 360px card) and becomes a bottom sheet
// instead.
const NARROW_QUERY = "(max-width: 639px)";

/**
 * A word/phrase lookup popover with an internal "dictionary-style"
 * navigation stack: clicking an English run inside the card's own content
 * (an example sentence, or a run embedded in meaningJa/nuanceJa/etymologyJa)
 * pushes a new entry and fetches it in place, rather than opening a nested
 * GlossCard — mirroring how a paper/app dictionary lets you follow a
 * cross-reference without leaving the page. The "← 戻る" button pops back
 * to the previous entry, which is still sitting in the stack (no refetch).
 *
 * On narrow viewports (<640px) this renders as a bottom sheet instead of an
 * anchored popover — `anchor` is then unused.
 */
export function GlossCard({ word, anchor, onClose }: GlossCardProps) {
  // Stable per-entry ids let the fetch effect below and handleRegenerate
  // target "the entry that was current when the request started" even if
  // the user has since pushed/popped past it. Starts at 0 (the initial
  // entry created below always gets id 0 on a fresh mount) and is only ever
  // read/written from event handlers afterwards, never during render.
  const idRef = useRef(0);
  const [stack, dispatch] = useReducer(glossNavReducer, undefined, () =>
    glossNavReducer([], {
      type: "reset",
      id: 0,
      word,
      cached: getCachedWordInfo(cacheKey(word)) ?? null,
    })
  );
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const isNarrow = useMediaQuery(NARROW_QUERY);

  const top = stack[stack.length - 1];

  useEffect(() => {
    // A cache hit is already captured in the entry's `info` at push/reset
    // time (see handleLookup / the useReducer initializer above) — this
    // effect only needs to fetch on a genuine cache miss, and re-runs
    // whenever navigation changes which entry is on top.
    if (top.info) return;

    let cancelled = false;

    fetch("/api/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: top.word }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(data?.error ?? "取得に失敗しました。");
        }
        return (await res.json()) as WordLookupResult;
      })
      .then((data) => {
        if (cancelled) return;
        setCachedWordInfo(cacheKey(top.word), data);
        dispatch({ type: "loaded", id: top.id, info: data });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        dispatch({
          type: "failed",
          id: top.id,
          error: e instanceof Error ? e.message : "取得に失敗しました。",
        });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top.id]);

  // Pushes a new stack entry for a word/phrase clicked inside the card's own
  // content (WordInfoView's onLookup) — a cache hit resolves synchronously
  // via the reducer, a miss is picked up by the fetch effect above.
  function handleLookup(phrase: string) {
    idRef.current += 1;
    dispatch({
      type: "push",
      id: idRef.current,
      word: phrase,
      cached: getCachedWordInfo(cacheKey(phrase)) ?? null,
    });
  }

  function handleBack() {
    dispatch({ type: "pop" });
  }

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const res = await fetch("/api/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: top.word, force: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "再生成に失敗しました。");
      }
      const data = (await res.json()) as WordLookupResult;
      setCachedWordInfo(cacheKey(top.word), data);
      dispatch({ type: "loaded", id: top.id, info: data });
    } catch (e) {
      dispatch({
        type: "failed",
        id: top.id,
        error: e instanceof Error ? e.message : "再生成に失敗しました。",
      });
    } finally {
      setIsRegenerating(false);
    }
  }

  // Clamp the floating popover within the viewport once its size is known.
  // Not used at all in narrow/sheet mode, which is positioned by CSS alone
  // (inset-x-0 bottom-0) regardless of `anchor`.
  useLayoutEffect(() => {
    if (isNarrow) return;
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const margin = 12;
    let left = anchor.x;
    let top = anchor.y + 14;

    if (left + rect.width + margin > window.innerWidth) {
      left = window.innerWidth - rect.width - margin;
    }
    if (left < margin) left = margin;

    if (top + rect.height + margin > window.innerHeight) {
      top = anchor.y - rect.height - 14;
    }
    if (top < margin) top = margin;

    setPos({ left, top });
  }, [isNarrow, anchor, stack]);

  useEffect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <>
      {isNarrow && (
        // Dims the page behind the sheet; tapping it closes the sheet. The
        // same effect is also reachable via the existing document-level
        // outside-click/Escape handlers above, but the backdrop makes the
        // affordance visible.
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30"
        />
      )}
      <div
        ref={cardRef}
        className={
          isNarrow
            ? "gloss-card fixed inset-x-0 bottom-0 z-50 max-h-[75vh] w-full overflow-y-auto rounded-t-lg bg-white p-4"
            : "gloss-card fixed z-50 w-[min(360px,calc(100vw-24px))] max-h-[min(70vh,640px)] overflow-y-auto rounded-md bg-white p-4"
        }
        style={
          isNarrow
            ? undefined
            : pos
              ? { left: pos.left, top: pos.top }
              : { left: anchor.x, top: anchor.y, visibility: "hidden" }
        }
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="absolute right-3 top-3 text-lg leading-none text-[rgb(var(--gray))] hover:text-[rgb(var(--gray-dark))]"
        >
          ×
        </button>

        {top.error && (
          <div className="pr-6">
            <p className="font-serif-en text-lg text-[rgb(var(--gray-dark))]">{top.word}</p>
            <p className="mt-2 text-sm text-[var(--accent-dark)]">{top.error}</p>
          </div>
        )}

        {!top.error && !top.info && <GlossCardSkeleton word={top.word} />}

        {top.info && (
          <div className="pr-4">
            <WordInfoView
              info={top.info}
              surface={top.word}
              onLookup={handleLookup}
              onBack={stack.length > 1 ? handleBack : undefined}
              onInfoUpdated={(info) =>
                // Reuses the "loaded" action: from the reducer's point of
                // view, "examples were topped up" and "a fresh fetch
                // resolved" are the same thing — replace this entry's info,
                // clear its error. `cached: true` because this info is now
                // (freshly) persisted, same as any other post-generation
                // state — keeps the "保存済み/再生成" footer below showing.
                dispatch({ type: "loaded", id: top.id, info: { ...info, cached: true } })
              }
            />

            {top.info.cached && (
              <div className="mt-3 flex items-center gap-3 border-t border-[rgba(159,96,115,0.15)] pt-2 text-xs text-[rgb(var(--gray))]">
                <span>保存済み</span>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="text-[var(--accent)] hover:underline disabled:opacity-50"
                >
                  {isRegenerating ? "再生成中…" : "再生成"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function GlossCardSkeleton({ word }: { word: string }) {
  return (
    <div className="pr-4">
      <p className="font-serif-en text-xl text-[rgb(var(--gray-dark))]">{word}</p>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-4/5 animate-pulse rounded bg-[rgba(159,96,115,0.15)]" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-[rgba(159,96,115,0.15)]" />
        <div className="h-3 w-full animate-pulse rounded bg-[rgba(159,96,115,0.15)]" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-[rgba(159,96,115,0.15)]" />
      </div>
    </div>
  );
}
