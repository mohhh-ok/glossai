"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { WordInfo } from "@/lib/llm/schema";
import { PENDING_TEXT_KEY } from "@/lib/pendingText";
import { ExplainBody } from "./ExplainBody";
import { GlossableText } from "./GlossableText";
import { ReadAloudButton } from "./ReadAloudButton";
import { WordInfoView, SpeakerButton } from "./WordInfoView";
import { useTts } from "@/lib/useTts";

interface WordEntry {
  id: number;
  surface: string;
  key: string;
  info: WordInfo;
  lookup_count: number;
  last_seen_at: string;
  created_at: string;
}

interface ExplainEntry {
  id: number;
  text: string;
  body: string;
  provider: string | null;
  model: string | null;
  created_at: string;
}

interface HistoryResponse {
  words: WordEntry[];
  explains: ExplainEntry[];
}

type Tab = "word" | "explain";

const EXCERPT_LENGTH = 80;
const TOAST_DURATION_MS = 5000;

/** Toast shown after an optimistic delete: a message plus an optional undo
 * action. `onUndo` is omitted for a terminal error notice (nothing to undo). */
interface DeleteToastState {
  message: string;
  onUndo?: () => void;
}

export function HistoryView() {
  const router = useRouter();
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("word");
  const [filter, setFilter] = useState("");
  const [expandedWordIds, setExpandedWordIds] = useState<Set<number>>(new Set());
  const [expandedExplainIds, setExpandedExplainIds] = useState<Set<number>>(
    new Set()
  );
  const [toast, setToast] = useState<DeleteToastState | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only the latest delete's toast is ever shown — showToast always clears
  // whatever timer/toast came before it, rather than queuing.
  function showToast(message: string, onUndo?: () => void) {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, onUndo });
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  function dismissToast() {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = null;
    setToast(null);
  }

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then(async (res) => {
        if (!res.ok) throw new Error("履歴の取得に失敗しました。");
        return (await res.json()) as HistoryResponse;
      })
      .then((res) => {
        if (!cancelled) setData(res);
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

  const filteredWords = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.words;
    return data.words.filter(
      (entry) =>
        entry.surface.toLowerCase().includes(q) ||
        entry.info.meaningJa.toLowerCase().includes(q)
    );
  }, [data, filter]);

  const filteredExplains = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.explains;
    return data.explains.filter((entry) => entry.text.toLowerCase().includes(q));
  }, [data, filter]);

  function toggleWordExpanded(id: number) {
    setExpandedWordIds((prev) => toggleSet(prev, id));
  }

  // "例文をもっと生成" は WordInfoView 内で完結して永続化まで済ませるので、
  // ここでは一覧の state を新しい WordInfo で上書きするだけでよい(再フェッチ
  // 不要)。並び順(last_seen_at)は変わらないので insertWordSorted のような
  // 並べ替えは不要。
  function handleWordInfoUpdated(id: number, info: WordInfo) {
    setData(
      (prev) =>
        prev && {
          ...prev,
          words: prev.words.map((entry) =>
            entry.id === id ? { ...entry, info } : entry
          ),
        }
    );
  }

  function toggleExplainExpanded(id: number) {
    setExpandedExplainIds((prev) => toggleSet(prev, id));
  }

  async function handleDeleteWord(id: number) {
    const removed = data?.words.find((entry) => entry.id === id);
    if (!removed) return;
    // Optimistic removal — a single row, no confirm dialog per spec. Rolled
    // back only if the DELETE itself fails; otherwise a toast offers undo,
    // which restores from this captured row rather than re-fetching.
    setData(
      (prev) =>
        prev && { ...prev, words: prev.words.filter((entry) => entry.id !== id) }
    );
    try {
      const res = await fetch(`/api/history?type=word&id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      showToast("削除しました", async () => {
        const ok = await restoreWordEntry(removed);
        if (ok) {
          setData(
            (prev) => prev && { ...prev, words: insertWordSorted(prev.words, removed) }
          );
        } else {
          showToast("元に戻せませんでした");
        }
      });
    } catch {
      setData(
        (prev) => prev && { ...prev, words: insertWordSorted(prev.words, removed) }
      );
    }
  }

  async function handleDeleteExplain(id: number) {
    const removed = data?.explains.find((entry) => entry.id === id);
    if (!removed) return;
    setData(
      (prev) =>
        prev && {
          ...prev,
          explains: prev.explains.filter((entry) => entry.id !== id),
        }
    );
    try {
      const res = await fetch(`/api/history?type=explain&id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      showToast("削除しました", async () => {
        const ok = await restoreExplainEntry(removed);
        if (ok) {
          setData(
            (prev) =>
              prev && { ...prev, explains: insertExplainSorted(prev.explains, removed) }
          );
        } else {
          showToast("元に戻せませんでした");
        }
      });
    } catch {
      setData(
        (prev) =>
          prev && { ...prev, explains: insertExplainSorted(prev.explains, removed) }
      );
    }
  }

  function openInReader(text: string) {
    sessionStorage.setItem(PENDING_TEXT_KEY, text);
    router.push("/");
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

        <div className="mt-4 inline-flex rounded-full border border-[rgba(159,96,115,0.25)] p-0.5 text-sm">
          <TabButton active={tab === "word"} onClick={() => setTab("word")}>
            単語
          </TabButton>
          <TabButton active={tab === "explain"} onClick={() => setTab("explain")}>
            文章
          </TabButton>
        </div>

        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={
            tab === "word" ? "単語・意味で絞り込み…" : "本文で絞り込み…"
          }
          className="mt-4 w-full rounded-md border border-[rgba(159,96,115,0.3)] bg-white px-3 py-2 text-sm text-[rgb(var(--gray-dark))] outline-none focus:border-[var(--accent)]"
        />

        {loadError && (
          <p className="mt-8 text-sm text-[var(--accent-dark)]">{loadError}</p>
        )}

        {!loadError && data && tab === "word" && (
          <>
            {data.words.length === 0 ? (
              <p className="mt-10 text-sm leading-relaxed text-[rgb(var(--gray))]">
                まだ履歴がありません。英文を読んで単語をクリックすると、ここに溜まっていきます。
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-[rgba(159,96,115,0.15)]">
                {filteredWords.map((entry) => (
                  <WordRow
                    key={entry.id}
                    entry={entry}
                    expanded={expandedWordIds.has(entry.id)}
                    onToggle={() => toggleWordExpanded(entry.id)}
                    onDelete={() => handleDeleteWord(entry.id)}
                    onInfoUpdated={(info) => handleWordInfoUpdated(entry.id, info)}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {!loadError && data && tab === "explain" && (
          <>
            {data.explains.length === 0 ? (
              <p className="mt-10 text-sm leading-relaxed text-[rgb(var(--gray))]">
                まだ解説の履歴がありません。リーダーで「AI解説」を実行すると、ここに保存されます。
              </p>
            ) : (
              <ul className="mt-6 divide-y divide-[rgba(159,96,115,0.15)]">
                {filteredExplains.map((entry) => (
                  <ExplainRow
                    key={entry.id}
                    entry={entry}
                    expanded={expandedExplainIds.has(entry.id)}
                    onToggle={() => toggleExplainExpanded(entry.id)}
                    onDelete={() => handleDeleteExplain(entry.id)}
                    onOpenInReader={() => openInReader(entry.text)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {toast && (
        <DeleteToast
          message={toast.message}
          onUndo={
            toast.onUndo
              ? () => {
                  toast.onUndo?.();
                  dismissToast();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 font-medium transition-colors ${
        active
          ? "bg-[var(--accent)] text-white"
          : "text-[rgb(var(--gray))] hover:text-[var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}

function WordRow({
  entry,
  expanded,
  onToggle,
  onDelete,
  onInfoUpdated,
}: {
  entry: WordEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onInfoUpdated: (info: WordInfo) => void;
}) {
  const { play, playingText } = useTts();
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
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <div className="min-w-0">
            <p className="font-serif-en text-lg text-[rgb(var(--gray-dark))]">
              {entry.surface}
            </p>
            <p className="truncate text-sm text-[rgb(var(--gray))]">
              {entry.info.meaningJa}
            </p>
          </div>
          <SpeakerButton
            label={`${entry.surface} の発音を再生`}
            active={playingText === entry.surface}
            onClick={(e) => {
              e.stopPropagation();
              play(entry.surface);
            }}
          />
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
          <WordInfoView
            info={entry.info}
            surface={entry.surface}
            onInfoUpdated={onInfoUpdated}
          />
        </div>
      )}
    </li>
  );
}

function ExplainRow({
  entry,
  expanded,
  onToggle,
  onDelete,
  onOpenInReader,
}: {
  entry: ExplainEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onOpenInReader: () => void;
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
        <p className="font-serif-en min-w-0 flex-1 truncate text-[15px] text-[rgb(var(--gray-dark))]">
          {excerptOf(entry.text, EXCERPT_LENGTH)}
        </p>
        <span className="shrink-0 text-xs text-[rgb(var(--gray))]">
          {formatMonthDay(entry.created_at)}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="この解説を削除"
          className="shrink-0 text-lg leading-none text-[rgb(var(--gray))] opacity-0 transition-opacity hover:text-[var(--accent-dark)] focus-visible:opacity-100 group-hover:opacity-100"
        >
          ×
        </button>
      </div>

      {expanded && (
        <div className="gloss-card mt-3 rounded-md bg-white p-4">
          <GlossableText text={entry.text} variant="quote" />
          <ReadAloudButton text={entry.text} className="mt-3" />
          <ExplainBody text={entry.body} className="mt-4" />
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={onOpenInReader}
              className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-[var(--accent-dark)]"
            >
              リーダーで開く
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Bottom-of-screen confirmation shown after an optimistic history delete.
 * Matches the app's existing card tone (white + gloss-card's shadow/accent
 * border) with the undo action styled as an accent-colored link. Auto-
 * dismissed by the caller after TOAST_DURATION_MS; `onUndo` is omitted for a
 * terminal notice (e.g. "restore failed") that has nothing to undo. */
function DeleteToast({
  message,
  onUndo,
}: {
  message: string;
  onUndo?: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="gloss-card pointer-events-auto flex items-center gap-4 rounded-md bg-white px-4 py-3">
        <span className="text-sm text-[rgb(var(--gray-dark))]">{message}</span>
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="text-sm font-bold text-[var(--accent)] hover:text-[var(--accent-dark)] hover:underline"
          >
            元に戻す
          </button>
        )}
      </div>
    </div>
  );
}

function toggleSet(prev: Set<number>, id: number): Set<number> {
  const next = new Set(prev);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

/** Collapses whitespace/newlines and clips to `max` chars for a list excerpt. */
function excerptOf(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? `${collapsed.slice(0, max)}…` : collapsed;
}

function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Posts a previously-deleted word row to /api/history/restore. Returns
 * whether the restore succeeded; never throws (a network failure is just
 * another "not ok"). */
async function restoreWordEntry(entry: WordEntry): Promise<boolean> {
  try {
    const res = await fetch("/api/history/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "word", entry }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Same as restoreWordEntry, for a deleted explain row. */
async function restoreExplainEntry(entry: ExplainEntry): Promise<boolean> {
  try {
    const res = await fetch("/api/history/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "explain", entry }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Re-inserts a restored word row at its original sort position — matching
 * /api/history's ORDER BY last_seen_at DESC, which restore preserves, this
 * reproduces the same order as a full refetch would, without one. */
function insertWordSorted(words: WordEntry[], entry: WordEntry): WordEntry[] {
  const next = [...words.filter((w) => w.id !== entry.id), entry];
  next.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
  return next;
}

/** Same as insertWordSorted, matching /api/history's explains
 * ORDER BY created_at DESC. */
function insertExplainSorted(
  explains: ExplainEntry[],
  entry: ExplainEntry
): ExplainEntry[] {
  const next = [...explains.filter((e) => e.id !== entry.id), entry];
  next.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return next;
}
