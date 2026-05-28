/**
 * CORS allowed origin の検証。Vercel preview / 本番 / Chrome 拡張機能 / 不許可をそれぞれ。
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAllowedOrigin } from "../_lib/cors";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker.vercel.app";
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("isAllowedOrigin", () => {
  it("環境変数 ALLOWED_ORIGIN と完全一致は許可", () => {
    expect(isAllowedOrigin("https://meeting-slot-picker.vercel.app")).toBe(true);
  });

  it("Vercel preview ドメインは許可", () => {
    expect(isAllowedOrigin("https://meeting-slot-picker-abc123-foo.vercel.app")).toBe(true);
  });

  it("Chrome 拡張機能 ID (32 文字 a-p) は許可", () => {
    expect(
      isAllowedOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop"),
    ).toBe(true);
  });

  it("Chrome 拡張機能 ID の形式が不正な場合は不許可", () => {
    expect(isAllowedOrigin("chrome-extension://invalid")).toBe(false);
    expect(isAllowedOrigin("chrome-extension://abcdefg")).toBe(false);
    expect(
      isAllowedOrigin("chrome-extension://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz"),
    ).toBe(false); // z は範囲外
  });

  it("関係ない origin は不許可", () => {
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedOrigin("http://meeting-slot-picker.vercel.app")).toBe(false); // http はダメ
  });

  it("origin が空なら不許可", () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });
});
