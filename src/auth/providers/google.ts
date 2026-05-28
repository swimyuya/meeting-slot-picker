/**
 * Google Calendar provider の OAuth 仕様。
 *
 * - access_type=offline + prompt=consent で refresh_token を毎回得る (再連携時に有効)
 * - scope に openid + email を含めて id_token で user email を取得できるようにする
 *   (将来のサブスク用 user identity の取得用)
 */

import type { ProviderOAuthSpec } from "./types";

export const GOOGLE_SPEC: ProviderOAuthSpec = {
  authEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  defaultScope:
    "openid email https://www.googleapis.com/auth/calendar.readonly",
  defaultPort: 4321,
  extraAuthParams: {
    access_type: "offline",
    prompt: "consent",
  },
  noRefreshTokenMessage:
    "refresh_token が返りませんでした。Google アカウント設定でアクセスを一度解除してから再試行してください。",
  displayName: "Google",
};
