/**
 * 環境変数 (Vite import.meta.env)。Google OAuth クライアント情報。
 *
 * 注意: VITE_ プレフィックスの変数はビルド成果物に文字列として埋め込まれる。
 * 真の機密情報には使わないこと。client_id と Desktop クライアントの
 * client_secret (Google が「非機密」と定義) のみここで扱う。
 *
 * Web 版 (PWA) では client_secret はサーバ側 (/api/auth/*) のみで使うので、
 * GOOGLE_CLIENT_SECRET は undefined のまま運用する。
 */

import { isTauri } from "./tauri";

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

/** Desktop クライアントで token endpoint が secret を要求する場合のみ使用。Web では undefined。 */
export const GOOGLE_CLIENT_SECRET: string | undefined =
  (import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined) || undefined;

export const isClientIdConfigured = (): boolean => GOOGLE_CLIENT_ID.length > 0;

/** Web ビルド用 API ベース URL。空文字 = 同一オリジン (Vercel 内 /api/* を呼ぶ既定)。 */
const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

/**
 * OAuth redirect_uri を環境に応じて返す。
 * - Tauri: loopback (http://127.0.0.1:PORT) → oauth.ts 内で組み立て
 * - Web: ${window.location.origin}/auth/callback
 */
export function getWebRedirectUri(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/auth/callback`;
}

/** 実行環境が Web (PWA / ブラウザ) かどうか。Tauri でない = Web。 */
export const isWebRuntime = (): boolean => !isTauri();
