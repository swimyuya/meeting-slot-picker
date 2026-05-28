/**
 * Web OAuth フロー (oauth-web.ts) の検証 (provider 引数化版)。
 * - signInWeb は sessionStorage に provider 付きで verifier/state を残し location.href を変える
 * - handleAuthCallback は state 照合 → /api/auth/exchange に provider 付き POST → 保存
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
  it("Google: verifier/state/provider を sessionStorage に保存し、Google 認可 URL にリダイレクト", async () => {
    const promise = signInWeb("google", {
      clientId: "cid",
      redirectUri: "https://example.com/auth/callback",
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(window.location.href).toContain("accounts.google.com");
    expect(sessionStorage.getItem("msp:oauth:provider")).toBe("google");
    expect(sessionStorage.getItem("msp:oauth:verifier")).toBeTruthy();
    void promise;
  });

  it("Microsoft: login.microsoftonline.com にリダイレクト", async () => {
    const promise = signInWeb("microsoft", {
      clientId: "ms-cid",
      redirectUri: "https://example.com/auth/callback",
    });
    await new Promise((r) => setTimeout(r, 30));
    expect(window.location.href).toContain("login.microsoftonline.com");
    expect(sessionStorage.getItem("msp:oauth:provider")).toBe("microsoft");
    void promise;
  });

  it("clientId が空なら throw する", async () => {
    await expect(
      signInWeb("google", {
        clientId: "",
        redirectUri: "https://example.com/auth/callback",
      }),
    ).rejects.toThrow(/CLIENT/i);
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

  function seedSession(provider: "google" | "microsoft" = "google") {
    sessionStorage.setItem("msp:oauth:verifier", "verifier-xyz");
    sessionStorage.setItem("msp:oauth:state", "state-abc");
    sessionStorage.setItem("msp:oauth:redirect_uri", "https://example.com/auth/callback");
    sessionStorage.setItem("msp:oauth:provider", provider);
  }

  it("正常系 (Google): /api/auth/exchange に POST し refresh_token を保存", async () => {
    seedSession("google");
    setLocation("?code=AUTHCODE&state=state-abc");

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: "rt-NEW", access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await handleAuthCallback({ fetchFn });

    expect(fetchFn).toHaveBeenCalledOnce();
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.provider).toBe("google");
    expect(body.code).toBe("AUTHCODE");
    expect(await getRefreshToken("google")).toBe("rt-NEW");
  });

  it("正常系 (Microsoft): provider=microsoft で POST", async () => {
    seedSession("microsoft");
    setLocation("?code=MSCODE&state=state-abc");

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: "ms-rt", access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await handleAuthCallback({ fetchFn });
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.provider).toBe("microsoft");
    expect(await getRefreshToken("microsoft")).toBe("ms-rt");
  });

  it("state 不一致は throw する", async () => {
    seedSession("google");
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
    seedSession("google");
    setLocation("?code=C&state=state-abc");
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
