"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { WordInfo } from "@/lib/llm/schema";
import { WordInfoView } from "./WordInfoView";

interface HistoryEntry {
  id: number;
  surface: string;
  key: string;
  info: WordInfo;
  lookup_count: number;
  last_seen_at: string;
  created_at: string;
}

export function HistoryView() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then(async (res) => {
        if (!res.ok) throw new Error("履歴の取得に失敗しました。");
        return (await res.json()) as HistoryEntry[];
      })
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : "履歴の取得に失敗しました。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.surface.toLowerCase().includes(q) ||
        entry.info.meaningJa.toLowerCase().includes(q)
    );
  }, [entries, filter]);

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function handleDelete(id: number) {
    const prevEntries = entries;
    // Optimistic removal — a single row, no confirm dialog per spec. Rolled
    // back only if the DELETE itself fails.
    setEntries((cur) => cur?.filter((entry) => entry.id !== id) ?? cur);
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      setEntries(prevEntries ?? null);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[rgba(159,96,115,0.2)] px-6 py-4">
        <span className="text-xl font-bold tracking-tight text-[var(--accent)]">
          glossai
        </span>
        <Link
          href="/"
          className="text-sm font-medium text-[rgb(var(--gray))] hover:text-[var(--accent)]"
        >
          ← 戻る
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 py-10">
        <h1 className="text-lg font-bold tracking-tight text-[rgb(var(--gray-dark))]">
          履歴
        </h1>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="単語・意味で絞り込み…"
          className="mt-4 w-full rounded-md border border-[rgba(159,96,115,0.3)] bg-white px-3 py-2 text-sm text-[rgb(var(--gray-dark))] outline-none focus:border-[var(--accent)]"
        />

        {loadError && (
          <p className="mt-8 text-sm text-[var(--accent-dark)]">{loadError}</p>
        )}

        {!loadError && entries && entries.length === 0 && (
          <p className="mt-10 text-sm leading-relaxed text-[rgb(var(--gray))]">
            まだ履歴がありません。英文を読んで単語をクリックすると、ここに溜まっていきます。
          </p>
        )}

        {!loadError && entries && entries.length > 0 && (
          <ul className="mt-6 divide-y divide-[rgba(159,96,115,0.15)]">
            {filtered.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                expanded={expandedIds.has(entry.id)}
                onToggle={() => toggleExpanded(entry.id)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function HistoryRow({
  entry,
  expanded,
  onToggle,
  onDelete,
}: {
  entry: HistoryEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="group py-3">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onToggle();
        }}
        className="flex cursor-pointer items-center gap-3"
      >
        <div className="min-w-0 flex-1">
          <p className="font-serif-en text-lg text-[rgb(var(--gray-dark))]">
            {entry.surface}
          </p>
          <p className="truncate text-sm text-[rgb(var(--gray))]">
            {entry.info.meaningJa}
          </p>
        </div>
        <span className="shrink-0 text-xs text-[rgb(var(--gray))]">
          {entry.lookup_count}回・{formatMonthDay(entry.last_seen_at)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`${entry.surface} を削除`}
          className="shrink-0 text-lg leading-none text-[rgb(var(--gray))] opacity-0 transition-opacity hover:text-[var(--accent-dark)] focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="gloss-card mt-3 rounded-md bg-white p-4">
          <WordInfoView info={entry.info} />
        </div>
      )}
    </li>
  );
}

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
