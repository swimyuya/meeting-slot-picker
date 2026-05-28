/**
 * CORS allowed origin の検証。
 *
 * 本セキュリティ修正後のポリシー:
 *  - 任意の `*.vercel.app` ワイルドカード許可は **廃止** (誰でも作成可能なため攻撃面が広い)
 *  - 任意の chrome-extension:// ワイルドカード許可も **廃止** (任意拡張から API を叩かれる)
 *  - 本番では ALLOWED_ORIGIN, VERCEL_URL, EXTENSION_ID env で明示された値のみ許可
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isAllowedOrigin } from "../_lib/cors";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  // テスト ごとに env を初期化 (clean state)
  process.env = { ...ORIG_ENV };
  delete process.env.ALLOWED_ORIGIN;
  delete process.env.VERCEL_URL;
  delete process.env.EXTENSION_ID;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe("isAllowedOrigin", () => {
  it("ALLOWED_ORIGIN 完全一致は許可", () => {
    process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker-pro.vercel.app";
    expect(isAllowedOrigin("https://meeting-slot-picker-pro.vercel.app")).toBe(true);
  });

  it("VERCEL_URL に一致する自分自身の deploy URL は許可", () => {
    process.env.VERCEL_URL = "meeting-slot-picker-pro-abc123.vercel.app";
    expect(isAllowedOrigin("https://meeting-slot-picker-pro-abc123.vercel.app")).toBe(true);
  });

  it("env で指定された EXTENSION_ID のみ chrome-extension origin を許可", () => {
    process.env.EXTENSION_ID = "abcdefghijklmnopabcdefghijklmnop";
    expect(
      isAllowedOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop"),
    ).toBe(true);
    expect(
      isAllowedOrigin("chrome-extension://opnmlkjihgfedcbaopnmlkjihgfedcba"),
    ).toBe(false);
  });

  it("任意の chrome-extension:// は許可しない (EXTENSION_ID 未設定でも)", () => {
    expect(
      isAllowedOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop"),
    ).toBe(false);
  });

  it("任意の *.vercel.app は許可しない", () => {
    expect(isAllowedOrigin("https://evil-app.vercel.app")).toBe(false);
    process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker-pro.vercel.app";
    // 別の vercel.app は引き続き不許可
    expect(isAllowedOrigin("https://attacker.vercel.app")).toBe(false);
  });

  it("関係ない origin / 不正な scheme は不許可", () => {
    process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker-pro.vercel.app";
    expect(isAllowedOrigin("https://evil.example.com")).toBe(false);
    expect(isAllowedOrigin("http://meeting-slot-picker-pro.vercel.app")).toBe(false); // http はダメ
  });

  it("origin が空なら不許可", () => {
    expect(isAllowedOrigin(undefined)).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });
});
