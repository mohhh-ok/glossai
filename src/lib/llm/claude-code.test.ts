import { describe, expect, it } from "vitest";
import {
  errorFromResultEvent,
  SUBTYPE_STRUCTURED_OUTPUT_FAILED,
  type ClaudeResultEvent,
} from "./claude-code";

const base: ClaudeResultEvent = {
  type: "result",
  subtype: "success",
  is_error: false,
  api_error_status: null,
  result: "",
};

describe("errorFromResultEvent", () => {
  // 実測ケース: error_max_structured_output_retries では result が null で
  // 実因は errors 配列にだけ入る。汎用「終了コードNで失敗」に握り潰さないこと。
  it("resultがnullでもerrors配列から実因を組み立てる", () => {
    const err = errorFromResultEvent(
      {
        ...base,
        subtype: SUBTYPE_STRUCTURED_OUTPUT_FAILED,
        is_error: true,
        result: null,
        errors: ["Failed to provide valid structured output after 5 attempts"],
      },
      1
    );
    expect(err.message).toContain("Failed to provide valid structured output");
    expect(err.message).toContain(SUBTYPE_STRUCTURED_OUTPUT_FAILED);
    expect(err.subtype).toBe(SUBTYPE_STRUCTURED_OUTPUT_FAILED);
  });

  it("resultもerrorsも空なら終了コード文言に落ちる", () => {
    const err = errorFromResultEvent(
      { ...base, subtype: "error", is_error: true, result: null },
      1
    );
    expect(err.message).toContain("終了コード1");
  });

  it("401はログイン案内に差し替える", () => {
    const err = errorFromResultEvent(
      {
        ...base,
        subtype: "error",
        is_error: true,
        result: "unauthorized",
        api_error_status: 401,
      },
      1
    );
    expect(err.message).toContain("ログイン");
    expect(err.apiErrorStatus).toBe(401);
  });
});
