import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearTokenCache, getAccessToken } from "../calendar/token";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const auth = { clientId: "cid", refreshToken: "rt" };

beforeEach(() => clearTokenCache());

describe("getAccessToken", () => {
  it("refresh_token を access_token に交換する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at1", expires_in: 3600 }));
    const token = await getAccessToken(auth, { fetchFn, now: () => 0 });
    expect(token).toBe("at1");
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect((init.body as URLSearchParams).get("grant_type")).toBe("refresh_token");
    expect((init.body as URLSearchParams).get("client_id")).toBe("cid");
  });

  it("マージン内はキャッシュを返し再取得しない", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at1", expires_in: 3600 }));
    await getAccessToken(auth, { fetchFn, now: () => 0 });
    const token = await getAccessToken(auth, { fetchFn, now: () => 1000 });
    expect(token).toBe("at1");
    expect(fetchFn).toHaveBeenCalledOnce();
  });

  it("期限切れ (マージン考慮) で再取得する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: "at1", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse({ access_token: "at2", expires_in: 3600 }));
    await getAccessToken(auth, { fetchFn, now: () => 0 });
    const token = await getAccessToken(auth, { fetchFn, now: () => 3_600_000 });
    expect(token).toBe("at2");
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("client_secret があれば送る", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at", expires_in: 3600 }));
    await getAccessToken({ ...auth, clientSecret: "sec" }, { fetchFn, now: () => 0 });
    const [, init] = fetchFn.mock.calls[0];
    expect((init.body as URLSearchParams).get("client_secret")).toBe("sec");
  });

  it("非200は本文付きで throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response("nope", { status: 400 }));
    await expect(getAccessToken(auth, { fetchFn, now: () => 0 })).rejects.toThrow(/400/);
  });

  it("access_token が無ければ throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}));
    await expect(getAccessToken(auth, { fetchFn, now: () => 0 })).rejects.toThrow(/access_token/);
  });

  it("同時呼び出しは1回のリクエストに集約する", async () => {
    let resolveFetch: (r: Response) => void = () => {};
    const fetchFn = vi.fn().mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = r;
      }),
    );
    const p1 = getAccessToken(auth, { fetchFn, now: () => 0 });
    const p2 = getAccessToken(auth, { fetchFn, now: () => 0 });
    resolveFetch(jsonResponse({ access_token: "at1", expires_in: 3600 }));
    expect(await p1).toBe("at1");
    expect(await p2).toBe("at1");
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
