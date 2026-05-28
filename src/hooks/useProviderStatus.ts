import { useCallback, useEffect, useState } from "react";
import { connect as connectProvider } from "../auth/oauth";
import { PROVIDER_IDS, type ProviderId } from "../auth/providers";
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  MICROSOFT_CLIENT_ID,
  MICROSOFT_CLIENT_SECRET,
} from "../lib/env";
import { errMessage } from "../lib/error";
import { deleteRefreshToken, getRefreshToken } from "../lib/secrets";

export type ConnectedState = Record<ProviderId, boolean | null>;
export type ProviderError = Partial<Record<ProviderId, string>>;

const INITIAL: ConnectedState = { google: null, microsoft: null };

/**
 * Provider 別の連携状態と接続/解除操作を提供するフック。
 * - 起動時に refresh_token の有無を provider 毎に確認
 * - connect/disconnect は provider 引数を取る
 * - busy は「いま接続/解除中の provider」を表す (null = アイドル)
 */
export function useProviderStatus() {
  const [connected, setConnected] = useState<ConnectedState>(INITIAL);
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [error, setError] = useState<ProviderError>({});

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      PROVIDER_IDS.map(async (p) => [p, Boolean(await getRefreshToken(p))] as const),
    );
    const next: ConnectedState = { ...INITIAL };
    for (const [p, ok] of entries) next[p] = ok;
    setConnected(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(
    async (provider: ProviderId) => {
      setBusy(provider);
      setError((e) => ({ ...e, [provider]: undefined }));
      try {
        const clientId = provider === "google" ? GOOGLE_CLIENT_ID : MICROSOFT_CLIENT_ID;
        const clientSecret =
          provider === "google" ? GOOGLE_CLIENT_SECRET : MICROSOFT_CLIENT_SECRET;
        await connectProvider(provider, { clientId, clientSecret });
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
      await deleteRefreshToken(provider);
      await refresh();
    },
    [refresh],
  );

  const hasAny = connected.google === true || connected.microsoft === true;
  const allKnown = connected.google !== null && connected.microsoft !== null;

  return { connected, busy, error, connect, disconnect, hasAny, allKnown };
}
