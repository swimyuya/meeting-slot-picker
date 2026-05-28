/**
 * Chrome 拡張機能 OAuth フロー (oauth-extension.ts) の検証。
 * chrome.identity と chrome.storage を vi.stubGlobal で偽装する。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signInExtension } from "../auth/oauth-extension";
import { getRefreshToken } from "../lib/secrets";

const REDIRECT_URI = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/";

function createFakeChrome(launchResult: string | null) {
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
      launchWebAuthFlow: vi.fn(
        async (_opts: { url: string; interactive: boolean }) => launchResult,
      ),
    },
  };
}

beforeEach(() => {
  // chrome.identity.launchWebAuthFlow で state が一致する code 付き URL を返す
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("signInExtension", () => {
  it("正常系: launchWebAuthFlow → /api/auth/exchange → refresh_token を保存", async () => {
    // 認可後に Chrome が返す URL をシミュレート
    // signInExtension が state を生成するため、URL を組み立てる際に
    // launchWebAuthFlow の引数から state を取り出す必要がある (動的)
    let stateUsed = "";
    const chrome = createFakeChrome("placeholder");
    chrome.identity.launchWebAuthFlow.mockImplementation(async (opts) => {
      const authUrl = new URL(opts.url);
      stateUsed = authUrl.searchParams.get("state") ?? "";
      return `${REDIRECT_URI}?code=AUTHCODE&state=${stateUsed}`;
    });
    vi.stubGlobal("chrome", chrome);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ refresh_token: "rt-EXT", access_token: "at" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await signInExtension({ clientId: "cid" }, { fetchFn });

    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledOnce();
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/api/auth/exchange");
    const body = JSON.parse(init!.body as string);
    expect(body).toMatchObject({
      code: "AUTHCODE",
      redirect_uri: REDIRECT_URI,
    });
    expect(body.code_verifier).toBeTruthy();

    expect(await getRefreshToken()).toBe("rt-EXT");
  });

  it("state 不一致は throw する", async () => {
    const chrome = createFakeChrome("placeholder");
    chrome.identity.launchWebAuthFlow.mockImplementation(async () => {
      return `${REDIRECT_URI}?code=AUTHCODE&state=attacker-state`;
    });
    vi.stubGlobal("chrome", chrome);

    await expect(signInExtension({ clientId: "cid" }, { fetchFn: vi.fn() })).rejects.toThrow(
      /state/,
    );
  });

  it("error パラメータがあれば throw する", async () => {
    const chrome = createFakeChrome("placeholder");
    chrome.identity.launchWebAuthFlow.mockImplementation(async () => {
      return `${REDIRECT_URI}?error=access_denied`;
    });
    vi.stubGlobal("chrome", chrome);

    await expect(
      signInExtension({ clientId: "cid" }, { fetchFn: vi.fn() }),
    ).rejects.toThrow(/access_denied/);
  });

  it("clientId が空なら throw する", async () => {
    vi.stubGlobal("chrome", createFakeChrome(""));
    await expect(signInExtension({ clientId: "" })).rejects.toThrow(/CLIENT_ID/);
  });

  it("/api/auth/exchange が失敗したら throw する", async () => {
    const chrome = createFakeChrome("placeholder");
    chrome.identity.launchWebAuthFlow.mockImplementation(async (opts) => {
      const state = new URL(opts.url).searchParams.get("state") ?? "";
      return `${REDIRECT_URI}?code=C&state=${state}`;
    });
    vi.stubGlobal("chrome", chrome);

    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    await expect(signInExtension({ clientId: "cid" }, { fetchFn })).rejects.toThrow(/exchange/);
  });
});
