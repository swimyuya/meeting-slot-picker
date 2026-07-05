/**
 * Microsoft の OAuth scope はクライアント (authorize) とサーバ (token endpoint) の
 * 両方で必要で、文字列が食い違うと token 交換が壊れる。
 * デプロイ物で api/ ↔ src/ を cross-import しない方針のため、二重定義を許した上で
 * このテストが同値を強制する (どちらかを変えたらもう片方も変えること)。
 */

import { describe, expect, it } from "vitest";
import { SCOPE } from "../_lib/microsoft.js";
import { MICROSOFT_SPEC } from "../../src/auth/providers/microsoft";

describe("Microsoft OAuth scope の client/server 同期", () => {
  it("api/_lib/microsoft.ts の SCOPE と MICROSOFT_SPEC.defaultScope は同一", () => {
    expect(SCOPE).toBe(MICROSOFT_SPEC.defaultScope);
  });
});
