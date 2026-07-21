import { describe, expect, it } from "vitest";
import { splitExplainSegments } from "./explainSegments";

describe("splitExplainSegments", () => {
  it("日本語のみの文はそのまま1つのjaセグメントになる", () => {
    expect(splitExplainSegments("これは日本語だけの文です。")).toEqual([
      { type: "ja", text: "これは日本語だけの文です。" },
    ]);
  });

  it("英語のみの文は末尾のピリオドまで含めて1つのenセグメントになる", () => {
    expect(splitExplainSegments("This is an example.")).toEqual([
      { type: "en", text: "This is an example." },
    ]);
  });

  it("日本語文中の英単語が1つのenセグメントとして抜き出される(混在)", () => {
    expect(
      splitExplainSegments("ここでbolster the caseという表現を使います。")
    ).toEqual([
      { type: "ja", text: "ここで" },
      { type: "en", text: "bolster the case" },
      { type: "ja", text: "という表現を使います。" },
    ]);
  });

  it("アポストロフィ・ハイフン付きの語も1つの島として連結される", () => {
    expect(splitExplainSegments("don't and well-known are common.")).toEqual([
      { type: "en", text: "don't and well-known are common." },
    ]);
  });

  it("カンマ・引用符・括弧・&を含む英文は分断されず1島に網羅される", () => {
    expect(
      splitExplainSegments(
        'call themselves “labs” when they are actually corporations'
      )
    ).toEqual([
      {
        type: "en",
        text: 'call themselves “labs” when they are actually corporations',
      },
    ]);
    expect(
      splitExplainSegments(
        'a lords & peasants culture between (looksmaxxing) "researchers" & engineers'
      )
    ).toEqual([
      {
        type: "en",
        text: 'a lords & peasants culture between (looksmaxxing) "researchers" & engineers',
      },
    ]);
  });

  it("英語のあとに日本語が続く場合、間の記号は島に吸収されない", () => {
    expect(splitExplainSegments("on one's better days — 「調子の良い時には」")).toEqual([
      { type: "en", text: "on one's better days" },
      { type: "ja", text: " — 「調子の良い時には」" },
    ]);
  });

  it("日本語を含む括弧書きは英語の島を連結しない", () => {
    expect(splitExplainSegments("researchers(研究者)を lords(貴族)になぞらえる")).toEqual([
      { type: "en", text: "researchers" },
      { type: "ja", text: "(研究者)を " },
      { type: "en", text: "lords" },
      { type: "ja", text: "(貴族)になぞらえる" },
    ]);
  });

  it("改行は島の切れ目になる", () => {
    expect(splitExplainSegments("first line\nsecond line")).toEqual([
      { type: "en", text: "first line" },
      { type: "ja", text: "\n" },
      { type: "en", text: "second line" },
    ]);
  });

  it("空文字は空配列を返す", () => {
    expect(splitExplainSegments("")).toEqual([]);
  });
});
