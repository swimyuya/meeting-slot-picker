/**
 * Web OAuth フロー (oauth-web.ts) の検証。
 * - signInWeb は sessionStorage に verifier/state/redirect_uri を残し、location.href を変える
 * - handleAuthCallback は state を照合して /api/auth/exchange に POST、refresh_token を保存
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearOAuthSession,
  handleAuthCallback,
  signInWeb,
} from "../auth/oauth-web";
import { getRefreshToken } from "../lib/secrets";

const ORIGINAL_LOCATION = window.location;

beforeEach(() => {
  sessionStorage.clear();
  // window.location を差し替え可能にする
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { ...ORIGINAL_LOCATION, href: "http://localhost/", search: "" },
  });
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: ORIGINAL_LOCATION,
  });
  clearOAuthSession();
});

describe("signInWeb", () => {
  it("verifier/state/redirect_uri を sessionStorage に保存し、location.href を Google 認可 URL にする", async () => {
    // signInWeb は通常 return しないので、Promise を race して location.href の更新を検出する
    const promise = signInWeb({
      clientId: "cid",
      redirectUri: "https://example.com/auth/callback",
    });
    // 少し待って location.href が変わったことを確認
    await new Promise((r) => setTimeout(r, 30));
    expect(window.location.href).toContain("accounts.google.com");
    expect(window.location.href).toContain("client_id=cid");
    expect(window.location.href).toContain(
      "redirect_uri=https%3A%2F%2Fexample.com%2Fauth%2Fcallback",
    );
    expect(sessionStorage.getItem("msp:oauth:verifier")).toBeTruthy();
    expect(sessionStorage.getItem("msp:oauth:state")).toBeTruthy();
    expect(sessionStorage.getItem("msp:oauth:redirect_uri")).toBe(
      "https://example.com/auth/callback",
    );
    // 後始末: race で勝てないので無視
    void promise;
  });

  it("clientId が空なら throw する", async () => {
    await expect(
      signInWeb({ clientId: "", redirectUri: "https://example.com/auth/callback" }),
    ).rejects.toThrow(/CLIENT_ID/);
  });
});

describe("handleAuthCallback", () => {
  function setLocation(search: string) {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...ORIGINAL_LOCATION, href: `http://localhost/auth/callback${search}`, search },
    });
  }

  it("正常系: state 一致 → /api/auth/exchange に POST → refresh_token を保存", async () => {
    sessionStorage.setItem("msp:oauth:verifier", "verifier-xyz");
    sessionStorage.setItem("msp:oauth:state", "state-abc");
    sessionStorage.setItem("msp:oauth:redirect_uri", "https://example.com/auth/callback");
    setLocation("?code=AUTHCODE&state=state-abc");

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: "rt-NEW", access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await handleAuthCallback({ fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/api/auth/exchange");
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({
      code: "AUTHCODE",
      code_verifier: "verifier-xyz",
      redirect_uri: "https://example.com/auth/callback",
    });
    expect(await getRefreshToken()).toBe("rt-NEW");
    // sessionStorage はクリアされる
    expect(sessionStorage.getItem("msp:oauth:state")).toBeNull();
  });

  it("state 不一致は throw する", async () => {
    sessionStorage.setItem("msp:oauth:verifier", "v");
    sessionStorage.setItem("msp:oauth:state", "state-expected");
    sessionStorage.setItem("msp:oauth:redirect_uri", "https://example.com/auth/callback");
    setLocation("?code=C&state=state-attacker");

    const fetchFn = vi.fn();
    await expect(handleAuthCallback({ fetchFn })).rejects.toThrow(/state/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("error パラメータがあれば throw する", async () => {
    setLocation("?error=access_denied");
    await expect(handleAuthCallback({ fetchFn: vi.fn() })).rejects.toThrow(/access_denied/);
  });

  it("/api/auth/exchange が失敗したら throw する", async () => {
    sessionStorage.setItem("msp:oauth:verifier", "v");
    sessionStorage.setItem("msp:oauth:state", "s");
    sessionStorage.setItem("msp:oauth:redirect_uri", "https://example.com/auth/callback");
    setLocation("?code=C&state=s");
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    await expect(handleAuthCallback({ fetchFn })).rejects.toThrow(/exchange/);
  });

  it("session が無いと throw する (再連携を促す)", async () => {
    setLocation("?code=C&state=s");
    await expect(handleAuthCallback({ fetchFn: vi.fn() })).rejects.toThrow(/セッション/);
  });
});
