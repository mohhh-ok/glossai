"use client";

import Link from "next/link";
import { useState } from "react";
import { SAMPLE_TEXT } from "@/lib/sample-text";

interface InputViewProps {
  onSubmit: (text: string) => void;
}

export function InputView({ onSubmit }: InputViewProps) {
  const [text, setText] = useState("");

  function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold tracking-tight text-[var(--accent)]">
          glossai
        </span>
        <Link
          href="/history"
          className="text-sm font-medium text-[rgb(var(--gray))] hover:text-[var(--accent)]"
        >
          履歴
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight text-[rgb(var(--gray-dark))]">
          英文を、AIと精読する。
        </h1>
        <p className="mt-2 text-sm text-[rgb(var(--gray))]">
          英文を貼り付けると、単語やフレーズの意味・発音・語源を日本語でその場で解説します。
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="ここに英文を貼り付けてください…"
          rows={12}
          className="font-serif-en mt-6 w-full resize-y rounded-md border border-[rgba(159,96,115,0.3)] bg-white p-4 text-[1.05rem] leading-relaxed text-[rgb(var(--gray-dark))] outline-none focus:border-[var(--accent)]"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--accent-dark)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            読む
          </button>
          <button
            type="button"
            onClick={() => setText(SAMPLE_TEXT)}
            className="rounded-full border border-[rgba(159,96,115,0.4)] px-5 py-2.5 text-sm font-medium text-[rgb(var(--gray-dark))] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            サンプル英文
          </button>
        </div>
      </main>
    </div>
  );
}
