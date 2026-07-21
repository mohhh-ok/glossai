import { describe, expect, it } from "vitest";
import { splitExplainSegments } from "./explainSegments";

describe("splitExplainSegments", () => {
  it("日本語のみの文はそのまま1つのjaセグメントになる", () => {
    expect(splitExplainSegments("これは日本語だけの文です。")).toEqual([
      { type: "ja", text: "これは日本語だけの文です。" },
    ]);
  });

  it("英語のみの文は句読点の手前までが1つのenセグメントになる", () => {
    expect(splitExplainSegments("This is an example.")).toEqual([
      { type: "en", text: "This is an example" },
      { type: "ja", text: "." },
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
      { type: "en", text: "don't and well-known are common" },
      { type: "ja", text: "." },
    ]);
  });

  it("カンマなど記号が来ると島が切れる(境界)", () => {
    expect(splitExplainSegments("yes, no")).toEqual([
      { type: "en", text: "yes" },
      { type: "ja", text: ", " },
      { type: "en", text: "no" },
    ]);
  });

  it("空文字は空配列を返す", () => {
    expect(splitExplainSegments("")).toEqual([]);
  });
});
