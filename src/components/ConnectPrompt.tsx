interface Props {
  onConnect: () => void;
  busy: boolean;
  error: string | null;
  clientIdMissing: boolean;
}

/** 未連携時の案内。Google 連携を開始する。 */
export function ConnectPrompt({ onConnect, busy, error, clientIdMissing }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <h2 className="text-base font-semibold text-gray-800">Google カレンダーと連携</h2>
      <p className="max-w-xs text-xs leading-5 text-gray-500">
        予定（busy）を読み取って空き枠の選択に使います。<br />
        読み取り専用（calendar.readonly）で、予定の作成・変更はしません。
      </p>
      {clientIdMissing && (
        <p className="max-w-xs break-words text-xs leading-5 text-red-600">
          VITE_GOOGLE_CLIENT_ID が未設定です。.env.local を設定してください。
        </p>
      )}
      <button
        type="button"
        onClick={onConnect}
        disabled={busy || clientIdMissing}
        className="rounded bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {busy ? "連携中…" : "Google と連携する"}
      </button>
      {error && <p className="max-w-xs text-xs text-red-600">{error}</p>}
    </div>
  );
}
