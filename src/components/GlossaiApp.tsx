"use client";

import { useState } from "react";
import { InputView } from "./InputView";
import { ReaderView } from "./ReaderView";

export function GlossaiApp() {
  const [text, setText] = useState<string | null>(null);

  if (text === null) {
    return <InputView onSubmit={setText} />;
  }

  return <ReaderView text={text} onBack={() => setText(null)} />;
}
