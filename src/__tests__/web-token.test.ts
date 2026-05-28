/**
 * Web 経路の getAccessToken: /api/auth/refresh を経由して access_token を取得する。
 * isTauri=false (jsdom 既定) で実行される。
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

describe("getAccessToken (Web 経路)", () => {
  const auth = { clientId: "cid", refreshToken: "rt-xyz" };

  it("/api/auth/refresh に refresh_token を JSON POST し access_token を取得する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at1", expires_in: 3600 }),
    );
    const token = await getAccessToken(auth, { fetchFn, now: () => 0 });
    expect(token).toBe("at1");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toContain("/api/auth/refresh");
    expect((init!.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init!.body as string);
    expect(body).toEqual({ refresh_token: "rt-xyz" });
  });

  it("キャッシュは Tauri 経路と共通: 同 refresh_token で再呼び出しでも 1 fetch", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at1", expires_in: 3600 }),
    );
    await getAccessToken(auth, { fetchFn, now: () => 0 });
    await getAccessToken(auth, { fetchFn, now: () => 1000 });
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("非200 は throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("err", { status: 500 }));
    await expect(getAccessToken(auth, { fetchFn, now: () => 0 })).rejects.toThrow(/refresh/);
  });
});
