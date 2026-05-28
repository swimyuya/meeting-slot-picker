/**
 * 環境変数 (Vite import.meta.env)。Google OAuth クライアント情報。
 *
 * 注意: VITE_ プレフィックスの変数はビルド成果物に文字列として埋め込まれる。
 * 真の機密情報には使わないこと。client_id と Desktop クライアントの
 * client_secret (Google が「非機密」と定義) のみここで扱う。
 */

export const GOOGLE_CLIENT_ID: string =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

/** Desktop クライアントで token endpoint が secret を要求する場合のみ使用。 */
export const GOOGLE_CLIENT_SECRET: string | undefined =
  (import.meta.env.VITE_GOOGLE_CLIENT_SECRET as string | undefined) || undefined;

export const isClientIdConfigured = (): boolean => GOOGLE_CLIENT_ID.length > 0;
