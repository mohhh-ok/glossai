"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  cacheKey,
  getCachedWordInfo,
  setCachedWordInfo,
  type WordLookupResult,
} from "@/lib/wordCache";
import { WordInfoView } from "./WordInfoView";

interface GlossCardProps {
  word: string;
  context: string;
  anchor: { x: number; y: number };
  onClose: () => void;
}

export function GlossCard({ word, context, anchor, onClose }: GlossCardProps) {
  const key = cacheKey(word, context);
  const [info, setInfo] = useState<WordLookupResult | null>(
    () => getCachedWordInfo(key) ?? null
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // GlossCard is remounted (via a `key` prop) each time the parent opens
    // a new lookup target, so the lazy useState initializer above already
    // covers the cache-hit case on mount — this effect only needs to fetch
    // on a genuine cache miss.
    if (getCachedWordInfo(key)) return;

    let cancelled = false;

    fetch("/api/word", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word, context }),
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
        setCachedWordInfo(key, data);
        setInfo(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "取得に失敗しました。");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  async function handleRegenerate() {
    setIsRegenerating(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, context, force: true }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "再生成に失敗しました。");
      }
      const data = (await res.json()) as WordLookupResult;
      setCachedWordInfo(key, data);
      setInfo(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "再生成に失敗しました。");
    } finally {
      setIsRegenerating(false);
    }
  }

  // Clamp the floating card within the viewport once its size is known.
  useLayoutEffect(() => {
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
  }, [anchor, info, loadError]);

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
    <div
      ref={cardRef}
      className="gloss-card fixed z-50 w-[min(360px,calc(100vw-24px))] rounded-md bg-white p-4"
      style={
        pos
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

      {loadError && (
        <div className="pr-6">
          <p className="font-serif-en text-lg text-[rgb(var(--gray-dark))]">{word}</p>
          <p className="mt-2 text-sm text-[var(--accent-dark)]">{loadError}</p>
        </div>
      )}

      {!loadError && !info && <GlossCardSkeleton word={word} />}

      {info && (
        <div className="pr-4">
          <WordInfoView info={info} />

          {info.cached && (
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
