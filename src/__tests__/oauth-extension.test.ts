/**
 * Chrome 拡張機能 OAuth フロー (provider 引数化版) の検証。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// 拡張ランタイムは VITE_API_BASE_URL を必須に。テスト用に stub する。
vi.stubEnv("VITE_API_BASE_URL", "https://example.test");

import { signInExtension } from "../auth/oauth-extension";
import { getRefreshToken } from "../lib/secrets";

beforeEach(() => {
  // env の stub は describe ごとに保持
});

const REDIRECT_URI = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/";

function createFakeChrome() {
  const store = new Map<string, unknown>();
  return {
    runtime: { id: "abcdefghijklmnopabcdefghijklmnop" },
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          const out: Record<string, unknown> = {};
          for (const k of arr) if (store.has(k)) out[k] = store.get(k);
          return out;
        }),
        set: vi.fn(async (items: Record<string, unknown>) => {
          for (const [k, v] of Object.entries(items)) store.set(k, v);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const arr = Array.isArray(keys) ? keys : [keys];
          for (const k of arr) store.delete(k);
        }),
      },
    },
    identity: {
      getRedirectURL: vi.fn((_path?: string) => REDIRECT_URI),
      launchWebAuthFlow: vi.fn(),
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signInExtension", () => {
  it("Google: launchWebAuthFlow → /api/auth/exchange (provider=google) → refresh_token を保存", async () => {
    const chrome = createFakeChrome();
    chrome.identity.launchWebAuthFlow.mockImplementation(async (opts: { url: string }) => {
      const state = new URL(opts.url).searchParams.get("state") ?? "";
      return `${REDIRECT_URI}?code=AUTHCODE&state=${state}`;
    });
    vi.stubGlobal("chrome", chrome);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: "rt-EXT", access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await signInExtension("google", { clientId: "cid" }, { fetchFn });
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.provider).toBe("google");
    expect(body.code).toBe("AUTHCODE");
    expect(await getRefreshToken("google")).toBe("rt-EXT");
  });

  it("Microsoft: provider=microsoft の body で POST、認可 URL は MS endpoint", async () => {
    const chrome = createFakeChrome();
    let urlSeen = "";
    chrome.identity.launchWebAuthFlow.mockImplementation(async (opts: { url: string }) => {
      urlSeen = opts.url;
      const state = new URL(opts.url).searchParams.get("state") ?? "";
      return `${REDIRECT_URI}?code=MS_CODE&state=${state}`;
    });
    vi.stubGlobal("chrome", chrome);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: "ms-rt", access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    await signInExtension("microsoft", { clientId: "ms-cid" }, { fetchFn });
    expect(urlSeen).toContain("login.microsoftonline.com");
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body.provider).toBe("microsoft");
    expect(await getRefreshToken("microsoft")).toBe("ms-rt");
  });

  it("state 不一致は throw する", async () => {
    const chrome = createFakeChrome();
    chrome.identity.launchWebAuthFlow.mockImplementation(async () => {
      return `${REDIRECT_URI}?code=AUTHCODE&state=attacker-state`;
    });
    vi.stubGlobal("chrome", chrome);

    await expect(
      signInExtension("google", { clientId: "cid" }, { fetchFn: vi.fn() }),
    ).rejects.toThrow(/state/);
  });

  it("error パラメータがあれば throw する", async () => {
    const chrome = createFakeChrome();
    chrome.identity.launchWebAuthFlow.mockImplementation(async () => {
      return `${REDIRECT_URI}?error=access_denied`;
    });
    vi.stubGlobal("chrome", chrome);

    await expect(
      signInExtension("google", { clientId: "cid" }, { fetchFn: vi.fn() }),
    ).rejects.toThrow(/access_denied/);
  });

  it("clientId が空なら throw する", async () => {
    vi.stubGlobal("chrome", createFakeChrome());
    await expect(signInExtension("google", { clientId: "" })).rejects.toThrow(/CLIENT/i);
  });

  it("/api/auth/exchange が失敗したら throw する", async () => {
    const chrome = createFakeChrome();
    chrome.identity.launchWebAuthFlow.mockImplementation(async (opts: { url: string }) => {
      const state = new URL(opts.url).searchParams.get("state") ?? "";
      return `${REDIRECT_URI}?code=C&state=${state}`;
    });
    vi.stubGlobal("chrome", chrome);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    await expect(
      signInExtension("google", { clientId: "cid" }, { fetchFn }),
    ).rejects.toThrow(/exchange/);
  });
});
