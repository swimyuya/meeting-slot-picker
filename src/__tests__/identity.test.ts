/**
 * JWT (id_token) からの email 抽出ユーティリティ検証。
 */

import { describe, expect, it } from "vitest";
import { emailFromIdToken } from "../auth/identity";

/** JWT を組み立てる (署名は不要、payload 部分のみ意味を持つ)。 */
function makeJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

/** UTF-8 文字列を base64url に。日本語等の non-Latin-1 を含むので Encoder 経由。 */
function base64UrlEncode(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("emailFromIdToken", () => {
  it("email クレームがあれば返す", () => {
    const token = makeJwt({ email: "user@example.com", sub: "abc" });
    expect(emailFromIdToken(token)).toBe("user@example.com");
  });

  it("Microsoft 形式 (preferred_username) でも返す", () => {
    const token = makeJwt({ preferred_username: "user@example.com", sub: "abc" });
    expect(emailFromIdToken(token)).toBe("user@example.com");
  });

  it("payload が UTF-8 (日本語 email 含むまれな例) でも壊さない", () => {
    const token = makeJwt({ email: "user@例.jp", name: "太郎" });
    expect(emailFromIdToken(token)).toBe("user@例.jp");
  });

  it("undefined / 空文字 / 不正な JWT は null", () => {
    expect(emailFromIdToken(undefined)).toBeNull();
    expect(emailFromIdToken("")).toBeNull();
    expect(emailFromIdToken("not-a-jwt")).toBeNull();
    expect(emailFromIdToken("a.b")).toBeNull(); // 2 parts でも b が JSON で無いので null
  });

  it("payload に email も preferred_username も無ければ null", () => {
    const token = makeJwt({ sub: "abc" });
    expect(emailFromIdToken(token)).toBeNull();
  });
});
