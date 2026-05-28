/**
 * Web 経路の getAccessToken: /api/auth/refresh を経由して access_token を取得する。
 * isTauri=false (jsdom 既定) で実行される。provider 引数つき。
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTokenCache, getAccessToken } from "../calendar/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => clearTokenCache());

describe("getAccessToken (Web 経路、provider-aware)", () => {
  const auth = { clientId: "cid", refreshToken: "rt-xyz" };

  it("Google: /api/auth/refresh に provider=google を含めて POST", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at1", expires_in: 3600 }),
    );
    await getAccessToken("google", auth, { fetchFn, now: () => 0 });
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/api/auth/refresh");
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ provider: "google", refresh_token: "rt-xyz" });
  });

  it("Microsoft: provider=microsoft を含めて POST", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "ms-at", expires_in: 3600 }),
    );
    await getAccessToken("microsoft", { ...auth, refreshToken: "ms-rt" }, { fetchFn, now: () => 0 });
    const [, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ provider: "microsoft", refresh_token: "ms-rt" });
  });

  it("provider が同じ refresh_token のキャッシュは共通", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at1", expires_in: 3600 }),
    );
    await getAccessToken("google", auth, { fetchFn, now: () => 0 });
    await getAccessToken("google", auth, { fetchFn, now: () => 1000 });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("非200 は throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("err", { status: 500 }));
    await expect(
      getAccessToken("google", auth, { fetchFn, now: () => 0 }),
    ).rejects.toThrow(/refresh/);
  });
});
