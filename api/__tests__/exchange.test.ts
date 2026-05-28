/**
 * Vercel function /api/auth/exchange のハンドラ単体テスト。
 *
 * - body の zod バリデーション
 * - CORS preflight (OPTIONS)
 * - Google token endpoint のモック呼び出し → tokens を返却
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// loadGoogleConfig が env を読むので、テストで env を仕込む。
const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker.vercel.app";
  // 本セキュリティ修正後、redirect_uri は allowlist に登録された値のみ許可される
  process.env.ALLOWED_REDIRECT_URIS =
    "https://meeting-slot-picker.vercel.app/auth/callback";
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
  vi.restoreAllMocks();
});

function mockRes() {
  const headers: Record<string, string> = {};
  return {
    statusCode: 200,
    body: undefined as unknown,
    headersSet: headers,
    setHeader(key: string, value: string) {
      headers[key] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
  } as unknown as VercelResponse & {
    statusCode: number;
    body: unknown;
    headersSet: Record<string, string>;
  };
}

describe("/api/auth/exchange", () => {
  it("OPTIONS preflight は 204 を返し CORS ヘッダを付与する", async () => {
    const handler = (await import("../auth/exchange")).default;
    const req = {
      method: "OPTIONS",
      headers: { origin: "https://meeting-slot-picker.vercel.app" },
      body: undefined,
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(204);
    expect((res as unknown as { headersSet: Record<string, string> }).headersSet[
      "Access-Control-Allow-Origin"
    ]).toBe("https://meeting-slot-picker.vercel.app");
  });

  it("GET は 405", async () => {
    const handler = (await import("../auth/exchange")).default;
    const req = { method: "GET", headers: {}, body: undefined } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(405);
  });

  it("body が不正なら 400", async () => {
    const handler = (await import("../auth/exchange")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker.vercel.app" },
      body: { code: "" }, // 空 code, code_verifier も無い
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(400);
  });

  it("正常系: code + verifier を投げると Google にリクエストして tokens を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const handler = (await import("../auth/exchange")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker.vercel.app" },
      body: {
        code: "AUTHCODE",
        code_verifier: "a".repeat(64),
        redirect_uri: "https://meeting-slot-picker.vercel.app/auth/callback",
      },
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200);
    expect((res as unknown as { body: unknown }).body).toMatchObject({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
    });
  });

  it("redirect_uri が allowlist に無いと 400 (本セキュリティ修正後)", async () => {
    const handler = (await import("../auth/exchange")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker.vercel.app" },
      body: {
        code: "AUTHCODE",
        code_verifier: "a".repeat(64),
        redirect_uri: "https://attacker.example.com/auth/callback",
      },
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(400);
  });

  it("Tauri ループバック http://127.0.0.1:PORT は redirect_uri として許可", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "at", refresh_token: "rt", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const handler = (await import("../auth/exchange")).default;
    const req = {
      method: "POST",
      headers: { origin: "https://meeting-slot-picker.vercel.app" },
      body: {
        code: "AUTHCODE",
        code_verifier: "a".repeat(64),
        redirect_uri: "http://127.0.0.1:4321",
      },
    } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200);
  });
});
