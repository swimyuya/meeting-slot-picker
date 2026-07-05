/**
 * Google OAuth token endpoint 中継。
 * クライアントから受けたパラメータに client_secret を付け足して Google に POST する。
 * client_secret は Vercel サーバ env (GOOGLE_CLIENT_SECRET) からのみ取得する。
 */

import { postTokenRequest } from "./token-request.js";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
}

export function loadGoogleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId) throw new Error("GOOGLE_CLIENT_ID is not configured");
  if (!clientSecret) throw new Error("GOOGLE_CLIENT_SECRET is not configured");
  return { clientId, clientSecret };
}

/** 認可コード → tokens (refresh_token + access_token)。 */
export async function exchangeAuthCode(args: {
  config: GoogleConfig;
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
  });
  const json = await postTokenRequest({
    endpoint: TOKEN_ENDPOINT,
    label: "google",
    op: "token exchange",
    body,
    fetchFn: args.fetchFn,
  });
  if (typeof json.refresh_token !== "string" || typeof json.access_token !== "string") {
    throw new Error("google token exchange: missing tokens in response");
  }
  return {
    refresh_token: json.refresh_token,
    access_token: json.access_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
    id_token: typeof json.id_token === "string" ? json.id_token : undefined,
  };
}

/** refresh_token → 新 access_token。 */
export async function refreshAccessToken(args: {
  config: GoogleConfig;
  refreshToken: string;
  fetchFn?: typeof fetch;
}): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    refresh_token: args.refreshToken,
    client_id: args.config.clientId,
    client_secret: args.config.clientSecret,
    grant_type: "refresh_token",
  });
  const json = await postTokenRequest({
    endpoint: TOKEN_ENDPOINT,
    label: "google",
    op: "refresh",
    body,
    fetchFn: args.fetchFn,
  });
  if (typeof json.access_token !== "string") {
    throw new Error("google refresh: missing access_token");
  }
  return {
    access_token: json.access_token,
    expires_in: typeof json.expires_in === "number" ? json.expires_in : 3600,
  };
}
