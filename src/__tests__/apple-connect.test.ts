/**
 * Apple Calendar 連携 (connectApple) の検証。
 */

import { describe, expect, it, vi } from "vitest";
import {
  connectApple,
  normalizeAppPassword,
} from "../auth/apple-connect";
import { getAppleCredentials } from "../lib/secrets";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("normalizeAppPassword", () => {
  it("ハイフン区切りを除去する", () => {
    expect(normalizeAppPassword("abcd-efgh-ijkl-mnop")).toBe(
      "abcdefghijklmnop",
    );
  });
  it("空白も除去する", () => {
    expect(normalizeAppPassword(" ab cd \t-ef\nghij ")).toBe("abcdefghij");
  });
  it("変更不要のものはそのまま", () => {
    expect(normalizeAppPassword("abcdefghijklmnop")).toBe("abcdefghijklmnop");
  });
});

describe("connectApple", () => {
  it("正常系: credentials を保存する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ events: [] }));
    await connectApple(
      { email: "u@example.com", appPassword: "abcd-efgh-ijkl-mnop" },
      { fetchFn },
    );

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/api/calendar/apple/events");
    const body = JSON.parse(init!.body as string);
    expect(body.email).toBe("u@example.com");
    expect(body.app_password).toBe("abcdefghijklmnop"); // ハイフン除去済

    const stored = await getAppleCredentials();
    expect(stored).toEqual({ email: "u@example.com", password: "abcdefghijklmnop" });
  });

  it("不正なメールは throw する", async () => {
    await expect(
      connectApple({ email: "invalid", appPassword: "abcdefghijklmnop" }),
    ).rejects.toThrow(/メール/);
  });

  it("短すぎるパスワードは throw する", async () => {
    await expect(
      connectApple({ email: "u@example.com", appPassword: "short" }),
    ).rejects.toThrow(/パスワード/);
  });

  it("401 は credentials エラーで throw する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "invalid_credentials" }, 401));
    await expect(
      connectApple(
        { email: "u@example.com", appPassword: "abcdefghijklmnop" },
        { fetchFn },
      ),
    ).rejects.toThrow(/アプリ用パスワード/);
  });

  it("500 系は接続エラーで throw する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: "caldav_failed" }, 500));
    await expect(
      connectApple(
        { email: "u@example.com", appPassword: "abcdefghijklmnop" },
        { fetchFn },
      ),
    ).rejects.toThrow(/iCloud/);
  });
});
