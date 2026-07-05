/**
 * Microsoft (Azure AD) OAuth token endpoint 中継。
 * クライアントから受けたパラメータに client_secret を付け足して Microsoft に POST する。
 * client_secret は Vercel サーバ env (MICROSOFT_CLIENT_SECRET) からのみ取得する。
 *
 * Pro 版で Outlook 連携を提供するためのバックエンド。
 */

import { postTokenRequest } from "./token-request.js";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

// scope は authorize と token endpoint の両方に必要 (v2.0 仕様)。
// クライアント側 src/auth/providers/microsoft.ts の MICROSOFT_SPEC.defaultScope と
// 揃える (scope-sync.test.ts が同値をテストで強制する)。
export const SCOPE = "openid email offline_access User.Read Calendars.Read";

export interface MicrosoftConfig {
  clientId: string;
  clientSecret: string;
}

export function loadMicrosoftConfig(): MicrosoftConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId) throw new Error("MICROSOFT_CLIENT_ID is not configured");
  if (!clientSecret) throw new Error("MICROSOFT_CLIENT_SECRET is not configured");
  return { clientId, clientSecret };
}

/** 認可コード → tokens。 */
export async function exchangeMicrosoftAuthCode(args: {
  config: MicrosoftConfig;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  fetchFn?: typeof fetch;
}): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  id_token?: string;
}> {
  const body = new URLSearchParams({
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: args.redirectUri,
    client_id: args.config.clientId,
    client_secret: args.config.clientSecret,
    grant_type: "authorization_code",
    scope: SCOPE,
  });
  const json = await postTokenRequest({
    endpoint: TOKEN_ENDPOINT,
    label: "microsoft",
    op: "token exchange",
    body,
    fetchFn: args.fetchFn,
  });
  if (typeof json.refresh_token !== "string" || typeof json.access_token !== "string") {
    throw new Error("microsoft token exchange: missing tokens in response");
  }
  return {
    refresh_token: json.refresh_token,
    access_token: json.access_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    id_token: typeof json.id_token === "string" ? json.id_token : undefined,
  };
}

/**
 * refresh_token → 新 access_token。
 *
 * Microsoft の v2.0 では refresh のたびに新しい refresh_token が返ることがある
 * (rotating refresh tokens)。クライアントへ id_token を含めて返し、
 * クライアントは更新版があれば再保存する。
 */
export async function refreshMicrosoftAccessToken(args: {
  config: MicrosoftConfig;
  refreshToken: string;
  fetchFn?: typeof fetch;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  id_token?: string;
}> {
  const body = new URLSearchParams({
    refresh_token: args.refreshToken,
    client_id: args.config.clientId,
    client_secret: args.config.clientSecret,
    grant_type: "refresh_token",
    scope: SCOPE,
  });
  const json = await postTokenRequest({
    endpoint: TOKEN_ENDPOINT,
    label: "microsoft",
    op: "refresh",
    body,
    fetchFn: args.fetchFn,
  });
  if (typeof json.access_token !== "string") {
    throw new Error("microsoft refresh: missing access_token");
  }
  return {
    access_token: json.access_token,
    refresh_token: typeof json.refresh_token === "string" ? json.refresh_token : undefined,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    id_token: typeof json.id_token === "string" ? json.id_token : undefined,
  };
}
