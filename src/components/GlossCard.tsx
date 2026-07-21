"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WordInfo } from "@/lib/llm/schema";
import { cacheKey, getCachedWordInfo, setCachedWordInfo } from "@/lib/wordCache";
import { useTts } from "@/lib/useTts";

interface GlossCardProps {
  word: string;
  context: string;
  anchor: { x: number; y: number };
  onClose: () => void;
}

export function GlossCard({ word, context, anchor, onClose }: GlossCardProps) {
  const key = cacheKey(word, context);
  const [info, setInfo] = useState<WordInfo | null>(() => getCachedWordInfo(key) ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { play, playingText, error: ttsError } = useTts();

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
        return (await res.json()) as WordInfo;
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
