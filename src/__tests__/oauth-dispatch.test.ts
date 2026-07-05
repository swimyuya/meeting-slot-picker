/**
 * connect() のランタイム dispatch (Chrome 拡張 / Web) を固定する。
 * Tauri (loopback) 経路は oauth.test.ts が captureCode 注入でカバー済み。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/tauri", () => ({
  isTauri: vi.fn(() => false),
  isExtension: vi.fn(() => false),
  isWebRuntime: vi.fn(() => true),
}));
vi.mock("../auth/oauth-web", () => ({
  signInWeb: vi.fn(async () => {}),
}));

import { connect } from "../auth/oauth";
import { signInWeb } from "../auth/oauth-web";
import { isExtension, isTauri } from "../lib/tauri";

beforeEach(() => {
  vi.mocked(isTauri).mockReturnValue(false);
  vi.mocked(isExtension).mockReturnValue(false);
  vi.mocked(signInWeb).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connect() の拡張ランタイム分岐", () => {
  it("background へ oauth_start メッセージ (provider + clientId/scope) を送る", async () => {
    vi.mocked(isExtension).mockReturnValue(true);
    const sendMessage = vi.fn(
      (_msg: unknown, cb: (r: { ok: boolean }) => void) => cb({ ok: true }),
    );
    vi.stubGlobal("chrome", { runtime: { sendMessage, lastError: undefined } });

    await connect("google", { clientId: "cid", scope: "sc" });

    expect(sendMessage).toHaveBeenCalledWith(
      { type: "oauth_start", provider: "google", config: { clientId: "cid", scope: "sc" } },
      expect.any(Function),
    );
  });

  it("background が ok:false を返したらそのエラーで reject する", async () => {
    vi.mocked(isExtension).mockReturnValue(true);
    const sendMessage = vi.fn(
      (_msg: unknown, cb: (r: { ok: boolean; error?: string }) => void) =>
        cb({ ok: false, error: "boom" }),
    );
    vi.stubGlobal("chrome", { runtime: { sendMessage, lastError: undefined } });

    await expect(connect("google", { clientId: "cid" })).rejects.toThrow(/boom/);
  });

  it("background 応答なしは no response エラーで reject する", async () => {
    vi.mocked(isExtension).mockReturnValue(true);
    const sendMessage = vi.fn(
      (_msg: unknown, cb: (r: undefined) => void) => cb(undefined),
    );
    vi.stubGlobal("chrome", { runtime: { sendMessage, lastError: undefined } });

    await expect(connect("google", { clientId: "cid" })).rejects.toThrow(
      /no response from background/,
    );
  });
});

describe("connect() の Web ランタイム分岐", () => {
  it("signInWeb に委譲する (redirectUri は origin + /auth/callback)", async () => {
    await connect("microsoft", { clientId: "ms-cid", scope: "s" });

    expect(signInWeb).toHaveBeenCalledWith("microsoft", {
      clientId: "ms-cid",
      redirectUri: `${window.location.origin}/auth/callback`,
      scope: "s",
    });
  });
});
