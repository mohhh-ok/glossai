"use client";

import { useCallback, useState } from "react";

// Module-level singletons: shared across every component instance so audio
// is fetched at most once per distinct text, and only one clip plays at a
// time regardless of which GlossCard triggered it.
const objectUrlCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;

export function useTts() {
  const [playingText, setPlayingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const play = useCallback(async (text: string) => {
    setError(null);
    try {
      let url = objectUrlCache.get(text);
      if (!url) {
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
        url = URL.createObjectURL(blob);
        objectUrlCache.set(text, url);
      }

      currentAudio?.pause();

      const audio = new Audio(url);
      currentAudio = audio;
      setPlayingText(text);
      audio.addEventListener("ended", () => {
        setPlayingText((prev) => (prev === text ? null : prev));
      });
      await audio.play();
    } catch (e) {
      setError(e instanceof Error ? e.message : "音声の再生に失敗しました。");
      setPlayingText(null);
    }
  }, []);

  return { play, playingText, error };
}
