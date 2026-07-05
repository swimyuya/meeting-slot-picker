/**
 * Vercel function /api/auth/refresh のハンドラ単体テスト。
 *
 * - method / body バリデーション
 * - Google: refresh_token grant を中継し access_token を返す
 * - Microsoft: scope 付き POST + rotating refresh_token をそのまま返す
 * - 上流失敗時は汎用 refresh_failed のみ返す
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.ALLOWED_ORIGIN = "https://meeting-slot-picker.vercel.app";
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

function postReq(body: unknown): VercelRequest {
  return {
    method: "POST",
    headers: { origin: "https://meeting-slot-picker.vercel.app" },
    body,
  } as unknown as VercelRequest;
}

describe("/api/auth/refresh", () => {
  it("GET は 405", async () => {
    const handler = (await import("../auth/refresh")).default;
    const req = { method: "GET", headers: {}, body: undefined } as unknown as VercelRequest;
    const res = mockRes();
    await handler(req, res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(405);
  });

  it("refresh_token が空なら 400", async () => {
    const handler = (await import("../auth/refresh")).default;
    const res = mockRes();
    await handler(postReq({ refresh_token: "" }), res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(400);
  });

  it("正常系 (google 既定): grant_type=refresh_token で中継し access_token を返す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ access_token: "new-at", expires_in: 3600 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const handler = (await import("../auth/refresh")).default;
    const res = mockRes();
    await handler(postReq({ refresh_token: "rt-1" }), res);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchSpy.mock.calls[0];
    const params = init!.body as URLSearchParams;
    expect(params.get("grant_type")).toBe("refresh_token");
    expect(params.get("refresh_token")).toBe("rt-1");
    expect(params.get("client_secret")).toBe("test-client-secret");
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200);
    expect((res as unknown as { body: unknown }).body).toMatchObject({
      access_token: "new-at",
      expires_in: 3600,
    });
  });

  it("provider=microsoft: scope 付き POST で rotating refresh_token も返す", async () => {
    process.env.MICROSOFT_CLIENT_ID = "ms-id";
    process.env.MICROSOFT_CLIENT_SECRET = "ms-secret";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "ms-at",
          refresh_token: "rotated-rt",
          expires_in: 1800,
          id_token: "ms-idt",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const handler = (await import("../auth/refresh")).default;
    const res = mockRes();
    await handler(postReq({ provider: "microsoft", refresh_token: "ms-rt" }), res);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = fetchSpy.mock.calls[0];
    const params = init!.body as URLSearchParams;
    expect(params.get("scope")).toBe("openid email offline_access User.Read Calendars.Read");
    expect(params.get("refresh_token")).toBe("ms-rt");
    expect((res as unknown as { statusCode: number }).statusCode).toBe(200);
    expect((res as unknown as { body: unknown }).body).toMatchObject({
      access_token: "ms-at",
      refresh_token: "rotated-rt",
      expires_in: 1800,
      id_token: "ms-idt",
    });
  });

  it("上流が失敗したら 500 refresh_failed (詳細は隠す)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }),
    );
    const handler = (await import("../auth/refresh")).default;
    const res = mockRes();
    await handler(postReq({ refresh_token: "rt-bad" }), res);
    expect((res as unknown as { statusCode: number }).statusCode).toBe(500);
    expect((res as unknown as { body: unknown }).body).toEqual({ error: "refresh_failed" });
  });
});
