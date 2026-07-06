import type { ReactNode } from "react";
import type { ProviderId } from "../auth/providers";
import type { ProviderError } from "../hooks/useProviderStatus";
import { AppleGlyph, GoogleGlyph, IconChevronRight, LogoMark, MicrosoftGlyph } from "./icons";

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
 * 未連携時のオンボーディング。Google / Outlook / Apple Calendar の 3 カードを並べる。
 * Apple カードを押すと OAuth ではなく専用モーダルが開く (親で制御)。
 */
export function ConnectPrompt({ onConnect, busy, errors, configMissing }: Props) {
  return (
    <div className="flex flex-1 animate-fade-in-up flex-col items-center justify-center gap-5 overflow-auto p-8 text-center">
      <LogoMark size={44} className="drop-shadow-sm" />
      <div className="space-y-1.5">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-zinc-50">
          カレンダーと連携
        </h2>
        <p className="max-w-xs text-xs leading-5 text-gray-500 dark:text-zinc-400">
          Google / Outlook / Apple Calendar の予定を読み取って空き枠の選択に使います。
          <br />
          読み取り専用で予定の作成・変更はしません。複数繋ぐと合算表示します。
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <ProviderCard
          glyph={<GoogleGlyph size={18} />}
          label="Google と連携する"
          busy={busy === "google"}
          disabled={configMissing.google}
          onClick={() => onConnect("google")}
        />
        {configMissing.google && (
          <p className="text-xs text-red-600 dark:text-red-400">VITE_GOOGLE_CLIENT_ID が未設定です。</p>
        )}
        {errors.google && <p className="alert-error text-left">{errors.google}</p>}

        <ProviderCard
          glyph={<MicrosoftGlyph size={16} />}
          label="Outlook と連携する"
          busy={busy === "microsoft"}
          disabled={configMissing.microsoft}
          onClick={() => onConnect("microsoft")}
        />
        {configMissing.microsoft && (
          <p className="text-xs text-red-600 dark:text-red-400">VITE_MICROSOFT_CLIENT_ID が未設定です。</p>
        )}
        {errors.microsoft && <p className="alert-error text-left">{errors.microsoft}</p>}

        <ProviderCard
          glyph={<AppleGlyph size={18} className="text-gray-900 dark:text-zinc-100" />}
          label="Apple Calendar と連携する"
          busy={busy === "apple"}
          disabled={false}
          onClick={() => onConnect("apple")}
        />
        {errors.apple && <p className="alert-error text-left">{errors.apple}</p>}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-zinc-500">
        🔒 認証情報は端末内 (Keychain / ブラウザ内ストレージ) にのみ保存されます
      </p>
    </div>
  );
}

function ProviderCard(props: {
  glyph: ReactNode;
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.busy || props.disabled}
      className="btn btn-secondary group w-full justify-between px-3.5 py-3 text-sm hover:border-brand-300 dark:hover:border-brand-700"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-200/70 dark:bg-zinc-900 dark:ring-zinc-700">
          {props.glyph}
        </span>
        <span className="font-medium">{props.busy ? "連携中…" : props.label}</span>
      </span>
      <IconChevronRight
        size={14}
        className="text-gray-300 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-brand dark:text-zinc-600"
      />
    </button>
  );
}
