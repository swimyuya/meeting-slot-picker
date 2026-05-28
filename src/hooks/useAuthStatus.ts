import { useCallback, useEffect, useState } from "react";
import { connectGoogle } from "../auth/oauth";
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../lib/env";
import { errMessage } from "../lib/error";
import { deleteRefreshToken, getRefreshToken } from "../lib/secrets";

/** Google 連携状態 (refresh_token の有無) と接続/解除操作を提供するフック。 */
export function useAuthStatus() {
  const [connected, setConnected] = useState<boolean | null>(null); // null = 確認中
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = await getRefreshToken();
    setConnected(Boolean(token));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await connectGoogle({ clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET });
      await refresh();
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const disconnect = useCallback(async () => {
    await deleteRefreshToken();
    await refresh();
  }, [refresh]);

  return { connected, busy, error, connect, disconnect };
}
