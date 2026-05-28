import type { ProviderId } from "../auth/providers";
import type { ProviderError } from "../hooks/useProviderStatus";

interface Props {
  /** いずれかのボタンが押されたら呼ばれる。provider 引数で識別。 */
  onConnect: (provider: ProviderId) => void;
  /** いま接続処理中の provider (null = アイドル)。 */
  busy: ProviderId | null;
  /** provider 別エラー。 */
  errors: ProviderError;
  /** provider 別の clientId 未設定フラグ (Apple は常に false)。 */
  configMissing: Record<ProviderId, boolean>;
}

/**
 * 未連携時の案内。Google / Outlook / Apple Calendar の 3 つのボタンを並べる。
 * Apple ボタンを押すと OAuth ではなく専用モーダルが開く (親で制御)。
 */
export function ConnectPrompt({ onConnect, busy, errors, configMissing }: Props) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-base font-semibold text-gray-800">カレンダーと連携</h2>
      <p className="max-w-xs text-xs leading-5 text-gray-500">
        Google / Outlook / Apple Calendar の予定を読み取って空き枠の選択に使います。<br />
        読み取り専用で予定の作成・変更はしません。複数繋ぐと合算表示します。
      </p>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <ConnectButton
          label="Google と連携する"
          busy={busy === "google"}
          disabled={configMissing.google}
          onClick={() => onConnect("google")}
          tone="brand"
        />
        {configMissing.google && (
          <p className="text-xs text-red-600">VITE_GOOGLE_CLIENT_ID が未設定です。</p>
        )}
        {errors.google && <p className="text-xs text-red-600">{errors.google}</p>}

        <ConnectButton
          label="Outlook と連携する"
          busy={busy === "microsoft"}
          disabled={configMissing.microsoft}
          onClick={() => onConnect("microsoft")}
          tone="microsoft"
        />
        {configMissing.microsoft && (
          <p className="text-xs text-red-600">VITE_MICROSOFT_CLIENT_ID が未設定です。</p>
        )}
        {errors.microsoft && (
          <p className="text-xs text-red-600">{errors.microsoft}</p>
        )}

        <ConnectButton
          label="Apple Calendar と連携する"
          busy={busy === "apple"}
          disabled={false}
          onClick={() => onConnect("apple")}
          tone="apple"
        />
        {errors.apple && <p className="text-xs text-red-600">{errors.apple}</p>}
      </div>
    </div>
  );
}

function ConnectButton(props: {
  label: string;
  busy: boolean;
  disabled: boolean;
  tone: "brand" | "microsoft" | "apple";
  onClick: () => void;
}) {
  const tone =
    props.tone === "microsoft"
      ? "bg-sky-600 text-white hover:bg-sky-700"
      : props.tone === "apple"
        ? "bg-pink-600 text-white hover:bg-pink-700"
        : "bg-brand text-white";
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.busy || props.disabled}
      className={`w-full rounded px-4 py-2 text-sm font-medium disabled:opacity-40 ${tone}`}
    >
      {props.busy ? "連携中…" : props.label}
    </button>
  );
}
