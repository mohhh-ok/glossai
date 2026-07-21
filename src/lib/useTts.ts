"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

// Module-level singletons: shared across every component instance so audio
// is fetched at most once per distinct text, and only one clip plays at a
// time regardless of which caller (a GlossCard's speaker button, the
// reader's full-passage read-aloud button, a history row's read-aloud
// button, ...) triggered it.
const objectUrlCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

/**
 * `playingText`/`loadingText` live here (module scope) rather than as local
 * `useState` in the hook, so every `useTts()` call site observes the same
 * playback slot. Multiple components can be mounted at once (e.g. two
 * expanded rows on /history, each with their own read-aloud button) — if
 * this were per-instance state, starting playback in one would leave the
 * other's button stuck showing "stop" even after its audio was paused out
 * from under it. useSyncExternalStore keeps every subscriber's snapshot in
 * sync with this single source of truth.
 */
interface TtsState {
  playingText: string | null;
  loadingText: string | null;
}

let state: TtsState = { playingText: null, loadingText: null };
const SERVER_SNAPSHOT: TtsState = { playingText: null, loadingText: null };
const listeners = new Set<() => void>();

function setState(patch: Partial<TtsState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): TtsState {
  return state;
}

function getServerSnapshot(): TtsState {
  return SERVER_SNAPSHOT;
}

async function fetchAudioUrl(text: string): Promise<string> {
  const cached = objectUrlCache.get(text);
  if (cached) return cached;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(data?.error ?? "音声の生成に失敗しました。");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  objectUrlCache.set(text, url);
  return url;
}

// Bumped on every playShared() call and checked after each await, so a
// superseded in-flight request (a newer play()/stop() came in while this one
// was still fetching or awaiting audio.play()) can't clobber state that no
// longer belongs to it.
let playToken = 0;

async function playShared(text: string): Promise<void> {
  const token = ++playToken;

  let url = objectUrlCache.get(text);
  if (!url) {
    setState({ loadingText: text });
    try {
      url = await fetchAudioUrl(text);
    } catch (e) {
      if (playToken === token) setState({ loadingText: null });
      throw e;
    }
  }
  if (playToken !== token) return; // superseded while fetching

  currentAudio?.pause();
  const audio = new Audio(url);
  currentAudio = audio;
  setState({ loadingText: null, playingText: text });

  audio.addEventListener("ended", () => {
    // Guards against a stale "ended" firing after a newer play() already
    // replaced currentAudio with a different element.
    if (currentAudio === audio) {
      currentAudio = null;
      setState({ playingText: null });
    }
  });

  try {
    await audio.play();
  } catch (e) {
    if (currentAudio === audio) {
      currentAudio = null;
      setState({ playingText: null });
    }
    throw e;
  }
}

/**
 * Stops playback. With `target` given, only stops if `target` is the text
 * currently playing or loading — a no-op otherwise, so an unmount/text-change
 * cleanup from one caller can't kill playback a different, newer play()
 * call already started for different text.
 */
function stopShared(target?: string): void {
  if (
    target !== undefined &&
    state.playingText !== target &&
    state.loadingText !== target
  ) {
    return;
  }
  playToken++; // invalidate any in-flight play() for the stopped text
  currentAudio?.pause();
  currentAudio = null;
  setState({ playingText: null, loadingText: null });
}

export function useTts() {
  const { playingText, loadingText } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  const [error, setError] = useState<string | null>(null);

  const play = useCallback(async (text: string) => {
    setError(null);
    try {
      await playShared(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "音声の再生に失敗しました。");
    }
  }, []);

  const stop = useCallback((target?: string) => {
    stopShared(target);
  }, []);

  return { play, stop, playingText, loadingText, error };
}
