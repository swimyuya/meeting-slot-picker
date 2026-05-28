/**
 * Microsoft (Outlook) Calendar provider の OAuth 仕様。
 *
 * - tenant=common: 個人 (outlook.com / hotmail.com / live.com) + 法人 (Microsoft 365)
 * - offline_access を scope に含めることで refresh_token が返る
 * - User.Read / Calendars.Read は Delegated permission
 * - openid + email で id_token から user email を取得 (サブスク用 identity)
 * - prompt=select_account: 既ログイン中でもアカウント選択画面を出して取り違え防止
 *
 * refresh_token は使うたび rotate される可能性があるため、refresh レスポンスに
 * 新しい refresh_token があったらクライアントで再保存すること (token.ts 側で対応)。
 */

import type { ProviderOAuthSpec } from "./types";

export const MICROSOFT_SPEC: ProviderOAuthSpec = {
  kind: "oauth-pkce",
  authEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
  defaultScope:
    "openid email offline_access User.Read Calendars.Read",
  defaultPort: 4322,
  extraAuthParams: {
    prompt: "select_account",
  },
  noRefreshTokenMessage:
    "refresh_token が返りませんでした。Outlook の連携をやり直してください (Microsoft アカウントのアプリ権限から一度解除すると確実です)。",
  displayName: "Outlook",
};
