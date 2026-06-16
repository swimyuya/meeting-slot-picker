import { beforeEach, describe, expect, it, vi } from "vitest";

// Tauri 経路 (provider の token endpoint へ直接 POST) の振る舞いを検証する。
// Web 経路 (/api/auth/refresh) は web-token.test.ts で別途検証する。
vi.mock("../lib/tauri", () => ({ isTauri: () => true }));

import {
  clearTokenCache,
  getAccessToken,
  isAuthExpiredError,
  TokenRefreshError,
} from "../calendar/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const auth = { clientId: "cid", refreshToken: "rt" };

beforeEach(() => clearTokenCache());

describe("getAccessToken (Tauri 経路、Google)", () => {
  it("Google token endpoint に POST して access_token を得る", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at1", expires_in: 3600 }),
    );
    const token = await getAccessToken("google", auth, { fetchFn, now: () => 0 });
    expect(token).toBe("at1");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect((init.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
    expect((init.body as URLSearchParams).get("client_id")).toBe("cid");
  });

  it("マージン内はキャッシュを返し再取得しない", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at1", expires_in: 3600 }),
    );
    await getAccessToken("google", auth, { fetchFn, now: () => 0 });
    const token = await getAccessToken("google", auth, { fetchFn, now: () => 1000 });
    expect(token).toBe("at1");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("期限切れで再取得する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "at1", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "at2", expires_in: 3600 }));
    await getAccessToken("google", auth, { fetchFn, now: () => 0 });
    const token = await getAccessToken("google", auth, { fetchFn, now: () => 3_600_000 });
    expect(token).toBe("at2");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("client_secret があれば送る", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "at", expires_in: 3600 }),
    );
    await getAccessToken("google", { ...auth, clientSecret: "sec" }, { fetchFn, now: () => 0 });
    const [, init] = fetchFn.mock.calls[0];
    expect((init.body as URLSearchParams).get("client_secret")).toBe("sec");
  });

  it("非200は throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 400 }));
    await expect(
      getAccessToken("google", auth, { fetchFn, now: () => 0 }),
    ).rejects.toThrow(/400/);
  });

  it("access_token が無ければ throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
    await expect(
      getAccessToken("google", auth, { fetchFn, now: () => 0 }),
    ).rejects.toThrow(/access_token/);
  });

  it("invalid_grant の 400 は TokenRefreshError(invalidGrant=true) を throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ error: "invalid_grant", error_description: "Token has expired" }, 400),
    );
    const err = await getAccessToken("google", auth, { fetchFn, now: () => 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(TokenRefreshError);
    expect(err.invalidGrant).toBe(true);
    expect(err.provider).toBe("google");
    expect(isAuthExpiredError(err)).toBe(true);
  });

  it("invalid_grant 以外の 400 は invalidGrant=false (再連携扱いしない)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("upstream boom", { status: 400 }));
    const err = await getAccessToken("google", auth, { fetchFn, now: () => 0 }).catch((e) => e);
    expect(err).toBeInstanceOf(TokenRefreshError);
    expect(err.invalidGrant).toBe(false);
    expect(isAuthExpiredError(err)).toBe(false);
  });

  it("同時呼び出しは1回のリクエストに集約する", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchFn = vi.fn().mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = r;
      }),
    );
    const p1 = getAccessToken("google", auth, { fetchFn, now: () => 0 });
    const p2 = getAccessToken("google", auth, { fetchFn, now: () => 0 });
    resolveFetch(jsonResponse({ access_token: "at1", expires_in: 3600 }));
    expect(await p1).toBe("at1");
    expect(await p2).toBe("at1");
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});

describe("getAccessToken (Tauri 経路、Microsoft)", () => {
  it("Microsoft token endpoint に POST する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      jsonResponse({ access_token: "ms-at", expires_in: 3600 }),
    );
    await getAccessToken("microsoft", auth, { fetchFn, now: () => 0 });
    expect(fetchFn.mock.calls[0][0]).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    );
  });
});
