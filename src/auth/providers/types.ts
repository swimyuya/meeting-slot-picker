/**
 * カレンダー provider (Google / Microsoft) を表す共通型。
 *
 * Pro 版で扱う provider は 2 つだけ。将来 Slack / Apple Calendar (CalDAV) 等を
 * 追加するときに ProviderId を拡張する。
 */

export type ProviderId = "google" | "microsoft";

export const PROVIDER_IDS: readonly ProviderId[] = ["google", "microsoft"] as const;

/**
 * 各 provider の OAuth エンドポイント仕様。
 * - PKCE は両 provider とも S256 に対応
 * - refresh_token を得るには Google は access_type=offline + prompt=consent、
 *   Microsoft は scope に offline_access を含める必要あり (provider 側で吸収)
 */
export interface ProviderOAuthSpec {
  /** 認可エンドポイント URL */
  readonly authEndpoint: string;
  /** トークン交換エンドポイント URL (Tauri 経由で直接 POST する用) */
  readonly tokenEndpoint: string;
  /** OAuth で要求する scope の既定値 (Calendar 読取 + identity 用 openid + email) */
  readonly defaultScope: string;
  /** Tauri loopback で使うポート (google: 4321, microsoft: 4322 — 衝突回避) */
  readonly defaultPort: number;
  /** 認可 URL に追加するクエリ (access_type=offline / prompt=consent 等、provider 仕様差) */
  readonly extraAuthParams?: Readonly<Record<string, string>>;
  /** refresh_token が返らなかったときに表示するメッセージ */
  readonly noRefreshTokenMessage: string;
  /** UI 表示用の和名 */
  readonly displayName: string;
}

/** クライアント側 OAuth 実行時に渡す設定。clientSecret は Tauri 経路 + Google でのみ使用。 */
export interface ProviderConfig {
  readonly clientId: string;
  readonly clientSecret?: string;
  readonly scope?: string;
}
