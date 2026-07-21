"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { GlossableText } from "./GlossableText";

interface ReaderViewProps {
  text: string;
  onBack: () => void;
}

export function ReaderView({ text, onBack }: ReaderViewProps) {
  const [explainText, setExplainText] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [hasExplained, setHasExplained] = useState(false);
  const explainAbortRef = useRef<AbortController | null>(null);

  async function handleExplain() {
    explainAbortRef.current?.abort();
    const controller = new AbortController();
    explainAbortRef.current = controller;

    setExplainText("");
    setExplainError(null);
    setIsExplaining(true);
    setHasExplained(true);

    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(data?.error ?? "解説の生成に失敗しました。");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setExplainText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setExplainError(e instanceof Error ? e.message : "エラーが発生しました。");
    } finally {
      setIsExplaining(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[rgba(159,96,115,0.2)] px-6 py-4">
        <span className="text-xl font-bold tracking-tight text-[var(--accent)]">
          glossai
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/history"
            className="text-sm font-medium text-[rgb(var(--gray))] hover:text-[var(--accent)]"
          >
            履歴
          </Link>
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-medium text-[rgb(var(--gray))] hover:text-[var(--accent)]"
          >
            ← 別のテキスト
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
        <GlossableText text={text} variant="reader" />

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={handleExplain}
            disabled={isExplaining}
            className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--accent-dark)] disabled:opacity-60"
          >
            {isExplaining ? "解説を生成中…" : "AI解説"}
          </button>
        </div>

        {hasExplained && (
          <section className="gloss-card mt-8 rounded-md bg-white p-6">
            <h2 className="text-xs font-bold text-[rgb(var(--gray))]">AI解説</h2>
            {explainError ? (
              <p className="mt-3 text-sm text-[var(--accent-dark)]">{explainError}</p>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed">
                {explainText}
                {isExplaining && (
                  <span className="ml-0.5 inline-block w-[0.5em] animate-pulse bg-[var(--accent)] align-baseline">
                    &nbsp;
                  </span>
                )}
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
