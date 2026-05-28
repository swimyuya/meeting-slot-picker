/**
 * OAuth id_token (JWT) から user の email を取り出すユーティリティ。
 *
 * - Google / Microsoft 両 provider とも、scope に `openid email` を含めると
 *   レスポンスに id_token が含まれる
 * - JWT は base64url(header).base64url(payload).signature の形式
 * - payload は JSON。`email` フィールドを取り出す
 *
 * 署名検証は行わない:
 *   - token endpoint への TLS 接続が信頼の根拠 (中間者が改ざんできない)
 *   - クライアントで JWT 署名検証する目的が無い (サーバへ持っていって権限判定するわけでもない)
 *   - 単に "このユーザーは誰?" を識別したいだけ → email を取れば十分
 *
 * 将来サブスク機能を載せたとき、この email をサーバ側 user 識別子として
 * Stripe Customer に紐付ける想定。
 */

interface IdTokenPayload {
  email?: string;
  preferred_username?: string; // Microsoft: email を持たない場合のフォールバック
  sub?: string;
}

export interface UserIdentity {
  email: string;
  /** どちらの provider の id_token から取り出したか */
  provider: "google" | "microsoft";
}

/** id_token のサイズ上限。標準的なものは 1KB 前後、極端に大きいものは拒否してメモリを守る。 */
const MAX_ID_TOKEN_BYTES = 8 * 1024;

/** JWT を decode して email を返す。失敗時 null。 */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken || idToken.length > MAX_ID_TOKEN_BYTES) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  // payload 単独でも上限を確認 (split 後の DoS を避ける)
  if (parts[1].length > MAX_ID_TOKEN_BYTES) return null;
  try {
    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as IdTokenPayload;
    return payload.email ?? payload.preferred_username ?? null;
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  // base64url → base64 (パディング補完含む)
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  // atob の出力はバイト文字列なので、UTF-8 として decode する
  const bin = atob(padded);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}
