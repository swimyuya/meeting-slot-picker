/**
 * カレンダー provider (Google / Microsoft / Apple) を表す共通型。
 *
 * Pro 版は 3 provider を扱う:
 *   - google / microsoft: OAuth 2.0 + PKCE
 *   - apple: CalDAV + アプリ用パスワード (OAuth 非対応)
 */

/** OAuth ベース provider (refresh_token / OAuth フローを持つ) */
export type OAuthProviderId = "google" | "microsoft";

/** すべての provider */
export type ProviderId = OAuthProviderId | "apple";

export const OAUTH_PROVIDER_IDS: readonly OAuthProviderId[] = [
  "google",
  "microsoft",
] as const;

export const PROVIDER_IDS: readonly ProviderId[] = [
  "google",
  "microsoft",
  "apple",
] as const;

/** provider が OAuth フローを使うか型ガード。 */
export function isOAuthProvider(p: ProviderId): p is OAuthProviderId {
  return p === "google" || p === "microsoft";
}

/**
 * OAuth ベース provider (Google / Microsoft) の仕様。
 */
export interface ProviderOAuthSpec {
  readonly kind: "oauth-pkce";
  /** 認可エンドポイント URL */
  readonly authEndpoint: string;
  /** トークン交換エンドポイント URL (Tauri 経由で直接 POST する用) */
  readonly tokenEndpoint: string;
  /** OAuth で要求する scope の既定値 */
  readonly defaultScope: string;
  /** Tauri loopback で使うポート (google: 4321, microsoft: 4322) */
  readonly defaultPort: number;
  /** 認可 URL に追加するクエリ */
  readonly extraAuthParams?: Readonly<Record<string, string>>;
  /** refresh_token が返らなかったときに表示するメッセージ */
  readonly noRefreshTokenMessage: string;
  /** UI 表示用の和名 */
  readonly displayName: string;
}

/**
 * Apple Calendar (iCloud CalDAV) の仕様。
 * OAuth と異なり、ユーザーが appleid.apple.com で発行したアプリ用パスワードを
 * メールと一緒に保存して使う。
 */
export interface AppleCredentialSpec {
  readonly kind: "apple-caldav";
  /** UI 表示用の和名 */
  readonly displayName: string;
  /** CalDAV サーバ URL */
  readonly caldavBaseUrl: string;
  /** アプリ用パスワードを生成するページの URL (UI のヘルプリンクで使う) */
  readonly appPasswordHelpUrl: string;
}

/** すべての provider 仕様を表す union */
export type ProviderSpec = ProviderOAuthSpec | AppleCredentialSpec;

/** クライアント側 OAuth 実行時に渡す設定。clientSecret は Tauri 経路 + Google でのみ使用。 */
export interface ProviderConfig {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly scope?: string;
}
