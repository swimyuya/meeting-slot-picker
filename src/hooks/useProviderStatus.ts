import { useCallback, useEffect, useState } from "react";
import { connect as connectProvider } from "../auth/oauth";
import {
  isOAuthProvider,
  PROVIDER_IDS,
  type ProviderId,
} from "../auth/providers";
import { getOAuthClientCredentials } from "../lib/env";
import { errMessage } from "../lib/error";
import {
  deleteAppleCredentials,
  deleteRefreshToken,
  getAppleCredentials,
  getRefreshToken,
} from "../lib/secrets";

export type ConnectedState = Record<ProviderId, boolean | null>;
export type ProviderError = Partial<Record<ProviderId, string>>;

const INITIAL: ConnectedState = { google: null, microsoft: null, apple: null };

/** refresh_token 失効を検知したときに表示するメッセージ。 */
const EXPIRED_MESSAGE =
  "連携の有効期限が切れました。お手数ですが再連携してください。";

/**
 * Provider 別の連携状態と接続/解除操作を提供するフック。
 * - 起動時に refresh_token (OAuth) / アプリ用パスワード (Apple) の有無を確認
 * - connect は OAuth provider のみ対応 (Apple はモーダル経由で別途接続)
 * - disconnect は 3 provider すべてに対応
 * - busy は「いま接続/解除中の provider」を表す (null = アイドル)
 */
export function useProviderStatus() {
  const [connected, setConnected] = useState<ConnectedState>(INITIAL);
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [error, setError] = useState<ProviderError>({});

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      PROVIDER_IDS.map(async (p) => {
        if (p === "apple") {
          return [p, Boolean(await getAppleCredentials())] as const;
        }
        return [p, Boolean(await getRefreshToken(p))] as const;
      }),
    );
    const next: ConnectedState = { ...INITIAL };
    for (const [p, ok] of entries) next[p] = ok;
    setConnected(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /**
   * OAuth 経路で連携。Apple は対応しないため、Apple は親コンポーネントで
   * モーダルを開いて connectApple() を呼び、その後に refreshConnected() で
   * 状態を取り直す。
   */
  const connect = useCallback(
    async (provider: ProviderId) => {
      if (!isOAuthProvider(provider)) {
        // Apple は OAuth ではないので呼び出し側で connectApple + refreshConnected
        return;
      }
      setBusy(provider);
      setError((e) => ({ ...e, [provider]: undefined }));
      try {
        await connectProvider(provider, getOAuthClientCredentials(provider));
        await refresh();
      } catch (e) {
        setError((prev) => ({ ...prev, [provider]: errMessage(e) }));
      } finally {
        setBusy(null);
      }
    },
    [refresh],
  );

  const disconnect = useCallback(
    async (provider: ProviderId) => {
      if (provider === "apple") {
        await deleteAppleCredentials();
      } else {
        await deleteRefreshToken(provider);
      }
      await refresh();
    },
    [refresh],
  );

  /**
   * refresh_token 失効 (invalid_grant) を検知したときの処理。
   * 失効済みトークンを破棄して連携状態を未接続に落とし、再連携を促す
   * メッセージをセットする。Google 単独連携なら App 側で ConnectPrompt
   * (ワンクリック再連携) に自動で切り替わる。
   */
  const markExpired = useCallback(
    async (provider: ProviderId) => {
      if (!isOAuthProvider(provider)) return;
      await deleteRefreshToken(provider);
      await refresh();
      setError((prev) => ({ ...prev, [provider]: EXPIRED_MESSAGE }));
    },
    [refresh],
  );

  const hasAny =
    connected.google === true ||
    connected.microsoft === true ||
    connected.apple === true;
  const allKnown =
    connected.google !== null &&
    connected.microsoft !== null &&
    connected.apple !== null;

  /** Apple の AppleConnectModal が成功した後に呼び出し、状態をリフレッシュさせる用。 */
  const refreshConnected = refresh;

  return {
    connected,
    busy,
    error,
    connect,
    disconnect,
    markExpired,
    hasAny,
    allKnown,
    refreshConnected,
    setError,
  };
}
