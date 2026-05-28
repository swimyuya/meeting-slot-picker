import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthUrl, connectGoogle, exchangeCode, generatePkce } from "../auth/oauth";
import { getRefreshToken } from "../lib/secrets";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => localStorage.clear());

describe("generatePkce", () => {
  it("base64url の verifier と、それと異なる S256 challenge を返す", async () => {
    const { verifier, challenge } = await generatePkce();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toBe(verifier);
  });
});

describe("buildAuthUrl", () => {
  it("必要なパラメータを全て含む", () => {
    const url = new URL(
      buildAuthUrl({
        clientId: "cid",
        redirectUri: "http://127.0.0.1:4321",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
        challenge: "ch",
        state: "st",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("client_id")).toBe("cid");
    expect(p.get("redirect_uri")).toBe("http://127.0.0.1:4321");
    expect(p.get("response_type")).toBe("code");
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("code_challenge")).toBe("ch");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe("st");
  });
});

describe("exchangeCode", () => {
  it("code を refresh_token に交換する (PKCE verifier を送る)", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ refresh_token: "rt", access_token: "at" }));
    const out = await exchangeCode(
      { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "http://127.0.0.1:4321" },
      { fetchFn },
    );
    expect(out.refreshToken).toBe("rt");
    const body = fetchFn.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("v");
    expect(body.get("code")).toBe("c");
  });

  it("refresh_token が無ければ throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at" }));
    await expect(
      exchangeCode({ clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "r" }, { fetchFn }),
    ).rejects.toThrow(/refresh_token/);
  });
});

describe("connectGoogle", () => {
  it("コード取得→交換→Keychain 保存まで実行する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ refresh_token: "rt-xyz", access_token: "at" }));
    const captureCode = vi.fn().mockResolvedValue("auth-code");
    await connectGoogle({ clientId: "cid" }, { fetchFn, captureCode });
    expect(captureCode).toHaveBeenCalledWith(
      4321,
      expect.stringContaining("accounts.google.com"),
      expect.any(String),
    );
    expect(await getRefreshToken()).toBe("rt-xyz");
  });

  it("clientId 未設定は throw する", async () => {
    await expect(connectGoogle({ clientId: "" })).rejects.toThrow(/CLIENT_ID/);
  });
});
