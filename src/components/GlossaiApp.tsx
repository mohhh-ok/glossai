"use client";

import { useEffect, useState } from "react";
import { PENDING_TEXT_KEY } from "@/lib/pendingText";
import { InputView } from "./InputView";
import { ReaderView } from "./ReaderView";

/**
 * Reads (without clearing) a passage handed off from /history's
 * "リーダーで開く" button. A pure read so it's safe as a useState
 * initializer — `window` doesn't exist during SSR, hence the guard, and
 * `sessionStorage.getItem` has no side effects even if React's Strict Mode
 * invokes this twice.
 */
function readPendingText(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(PENDING_TEXT_KEY);
}

export function GlossaiApp() {
  const [text, setText] = useState<string | null>(readPendingText);

  // Clears the handoff key so a stale value can't resurrect on a later
  // visit. This only touches the external system (sessionStorage), never
  // setState, so it's a legitimate effect rather than a render-time mutation.
  useEffect(() => {
    if (text !== null) sessionStorage.removeItem(PENDING_TEXT_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
  }, []);

  if (text === null) {
    return <InputView onSubmit={setText} />;
  }

  return <ReaderView text={text} onBack={() => setText(null)} />;
}
