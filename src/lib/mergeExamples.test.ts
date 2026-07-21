import { describe, expect, it } from "vitest";
import type { Example } from "./llm/schema";
import { mergeExamples, MAX_EXAMPLES_PER_WORD } from "./mergeExamples";

function ex(en: string, ja = `${en}(訳)`): Example {
  return { en, ja };
}

describe("mergeExamples", () => {
  it("既存を先頭に保った順序で新規を後ろに追加する", () => {
    const existing = [ex("a"), ex("b")];
    const added = [ex("c"), ex("d")];
    expect(mergeExamples(existing, added)).toEqual([
      ex("a"),
      ex("b"),
      ex("c"),
      ex("d"),
    ]);
  });

  it("en が既存と完全一致する新規は除外する", () => {
    const existing = [ex("a"), ex("b")];
    const added = [ex("b", "別訳でも本文が同じなら重複扱い"), ex("c")];
    expect(mergeExamples(existing, added)).toEqual([ex("a"), ex("b"), ex("c")]);
  });

  it("added 内部の重複も除外する", () => {
    const existing: Example[] = [];
    const added = [ex("x"), ex("x"), ex("y")];
    expect(mergeExamples(existing, added)).toEqual([ex("x"), ex("y")]);
  });

  it("10件を超える場合は先頭からMAX_EXAMPLES_PER_WORD件に切り詰める", () => {
    const existing = Array.from({ length: 8 }, (_, i) => ex(`e${i}`));
    const added = Array.from({ length: 5 }, (_, i) => ex(`a${i}`));
    const merged = mergeExamples(existing, added);
    expect(merged).toHaveLength(MAX_EXAMPLES_PER_WORD);
    expect(merged).toEqual([...existing, ex("a0"), ex("a1")]);
  });

  it("追加が空なら既存をそのまま返す", () => {
    const existing = [ex("a"), ex("b")];
    expect(mergeExamples(existing, [])).toEqual(existing);
  });

  it("既存が空なら追加のみになる(10件超は切り詰め)", () => {
    const added = Array.from({ length: 3 }, (_, i) => ex(`a${i}`));
    expect(mergeExamples([], added)).toEqual(added);
  });
});
