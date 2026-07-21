import { describe, expect, it } from "vitest";
import { glossNavReducer, type GlossNavEntry } from "./glossNavStack";

const cachedInfo = {
  word: "bolster",
  ipa: "/ˈboʊlstər/",
  partOfSpeech: "verb",
  meaningJa: "支える",
  nuanceJa: "",
  etymologyJa: "",
  examples: [],
  cached: true,
};

describe("glossNavReducer", () => {
  it("reset は単一エントリのスタックを作る", () => {
    const stack = glossNavReducer([], {
      type: "reset",
      id: 0,
      word: "case",
      cached: null,
    });
    expect(stack).toEqual([
      { id: 0, word: "case", info: null, error: null },
    ]);
  });

  it("push は末尾に新しいエントリを積み、cache hit の info をそのまま保持する", () => {
    const initial: GlossNavEntry[] = [
      { id: 0, word: "case", info: null, error: null },
    ];
    const stack = glossNavReducer(initial, {
      type: "push",
      id: 1,
      word: "bolster",
      cached: cachedInfo,
    });
    expect(stack).toHaveLength(2);
    expect(stack[0]).toBe(initial[0]); // 既存エントリは変更されない
    expect(stack[1]).toEqual({
      id: 1,
      word: "bolster",
      info: cachedInfo,
      error: null,
    });
  });

  it("pop は末尾のエントリを取り除き、深さ1では何もしない", () => {
    const depth2: GlossNavEntry[] = [
      { id: 0, word: "case", info: null, error: null },
      { id: 1, word: "bolster", info: cachedInfo, error: null },
    ];
    const popped = glossNavReducer(depth2, { type: "pop" });
    expect(popped).toEqual([depth2[0]]);

    const depth1 = popped;
    expect(glossNavReducer(depth1, { type: "pop" })).toBe(depth1);
  });
});
