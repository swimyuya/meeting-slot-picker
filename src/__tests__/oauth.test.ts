import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildAuthUrl, connect, exchangeCode, generatePkce } from "../auth/oauth";
import { GOOGLE_SPEC, MICROSOFT_SPEC } from "../auth/providers";
import { getRefreshToken } from "../lib/secrets";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// secrets テストの global beforeEach (setup.ts) で IndexedDB がクリアされる前提

beforeEach(() => {
  // each test isolated
});

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
  it("Google: 必要なパラメータを含み access_type=offline / prompt=consent を入れる", () => {
    const url = new URL(
      buildAuthUrl(GOOGLE_SPEC, {
        clientId: "cid",
        redirectUri: "http://127.0.0.1:4321",
        scope: "openid email https://www.googleapis.com/auth/calendar.readonly",
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

  it("Microsoft: login.microsoftonline.com に向き prompt=select_account を入れる", () => {
    const url = new URL(
      buildAuthUrl(MICROSOFT_SPEC, {
        clientId: "ms-cid",
        redirectUri: "http://127.0.0.1:4322",
        scope: MICROSOFT_SPEC.defaultScope,
        challenge: "ch",
        state: "st",
      }),
    );
    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("scope")).toContain("offline_access");
    expect(url.searchParams.get("scope")).toContain("Calendars.Read");
  });
});

describe("exchangeCode", () => {
  it("Google: code を refresh_token に交換する", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ refresh_token: "rt", access_token: "at" }));
    const out = await exchangeCode(
      GOOGLE_SPEC,
      { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "http://127.0.0.1:4321" },
      { fetchFn },
    );
    expect(out.refreshToken).toBe("rt");
    expect(fetchFn.mock.calls[0][0]).toBe(GOOGLE_SPEC.tokenEndpoint);
    const body = fetchFn.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code_verifier")).toBe("v");
    expect(body.get("code")).toBe("c");
  });

  it("Microsoft: token endpoint に向ける", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ refresh_token: "rt", access_token: "at" }));
    await exchangeCode(
      MICROSOFT_SPEC,
      { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "http://127.0.0.1:4322" },
      { fetchFn },
    );
    expect(fetchFn.mock.calls[0][0]).toBe(MICROSOFT_SPEC.tokenEndpoint);
  });

  it("refresh_token が無ければ provider 既定メッセージで throw する", async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ access_token: "at" }));
    await expect(
      exchangeCode(
        GOOGLE_SPEC,
        { clientId: "cid", code: "c", codeVerifier: "v", redirectUri: "r" },
        { fetchFn },
      ),
    ).rejects.toThrow(/Google/);
  });
});

describe("connect (Tauri 経路)", () => {
  it("コード取得→交換→Keychain 保存まで実行する (Google)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ refresh_token: "rt-xyz", access_token: "at" }));
    const captureCode = vi.fn().mockResolvedValue("auth-code");
    await connect("google", { clientId: "cid" }, { fetchFn, captureCode });
    expect(captureCode).toHaveBeenCalledWith(
      4321,
      expect.stringContaining("accounts.google.com"),
      expect.any(String),
    );
    expect(await getRefreshToken("google")).toBe("rt-xyz");
  });

  it("Microsoft でも同様 (port=4322, MS endpoint)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(jsonResponse({ refresh_token: "ms-rt", access_token: "at" }));
    const captureCode = vi.fn().mockResolvedValue("ms-code");
    await connect("microsoft", { clientId: "ms-cid" }, { fetchFn, captureCode });
    expect(captureCode).toHaveBeenCalledWith(
      4322,
      expect.stringContaining("login.microsoftonline.com"),
      expect.any(String),
    );
    expect(await getRefreshToken("microsoft")).toBe("ms-rt");
  });

  it("clientId 未設定は throw する", async () => {
    await expect(connect("google", { clientId: "" })).rejects.toThrow(/CLIENT/i);
  });
});
