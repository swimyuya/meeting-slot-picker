import { useState, type ReactNode } from "react";
import type { ProviderId } from "../auth/providers";
import type { useProviderStatus } from "../hooks/useProviderStatus";
import { AppConfigSchema, type AppConfig } from "../lib/config";
import { AppleGlyph, GoogleGlyph, MicrosoftGlyph } from "./icons";
import { ShortcutRecorder } from "./ShortcutRecorder";
import { SubscriptionBadge } from "./SubscriptionBadge";

type ProviderStatusReturn = ReturnType<typeof useProviderStatus>;

interface Props {
  config: AppConfig;
  onSave: (next: AppConfig) => Promise<void>;
  onClose: () => void;
  /** Pro 版: provider 連携状態。テストの単体レンダ (連携セクション無し) 用に optional。 */
  providerStatus?: ProviderStatusReturn;
  /** Pro 版: provider 別 clientId 未設定フラグ。 */
  configMissing?: Record<ProviderId, boolean>;
  /** Apple 連携モーダルを開く (apple は OAuth ではないため親で制御)。 */
  onOpenAppleModal?: () => void;
}

/** 表示範囲・出力テンプレート等の設定フォーム + Pro 版で連携状態セクション。 */
export function SettingsPanel({
  config,
  onSave,
  onClose,
  providerStatus,
  configMissing,
  onOpenAppleModal,
}: Props) {
  const [draft, setDraft] = useState<AppConfig>(config);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const handleSave = async () => {
    const result = AppConfigSchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "設定が不正です");
      return;
    }
    await onSave(result.data);
    onClose();
  };

  return (
    <div className="flex flex-1 animate-fade-in flex-col overflow-hidden">
      <div className="flex-1 space-y-5 overflow-auto p-4 text-xs">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-zinc-50">設定</h2>
          <SubscriptionBadge status="beta" />
        </div>

        {providerStatus && configMissing && (
          <section className="space-y-2">
            <h3 className="section-title">連携</h3>
            <div className="card divide-y divide-gray-100 overflow-hidden dark:divide-zinc-800">
              <ProviderRow
                provider="google"
                label="Google カレンダー"
                connected={providerStatus.connected.google}
                busy={providerStatus.busy === "google"}
                disabled={configMissing.google}
                error={providerStatus.error.google}
                onConnect={() => void providerStatus.connect("google")}
                onDisconnect={() => void providerStatus.disconnect("google")}
              />
              <ProviderRow
                provider="microsoft"
                label="Outlook カレンダー"
                connected={providerStatus.connected.microsoft}
                busy={providerStatus.busy === "microsoft"}
                disabled={configMissing.microsoft}
                error={providerStatus.error.microsoft}
                onConnect={() => void providerStatus.connect("microsoft")}
                onDisconnect={() => void providerStatus.disconnect("microsoft")}
              />
              <ProviderRow
                provider="apple"
                label="Apple Calendar"
                connected={providerStatus.connected.apple}
                busy={providerStatus.busy === "apple"}
                disabled={false}
                error={providerStatus.error.apple}
                onConnect={() => onOpenAppleModal?.()}
                onDisconnect={() => void providerStatus.disconnect("apple")}
              />
            </div>
          </section>
        )}

        <section className="space-y-2">
          <h3 className="section-title">表示範囲</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="開始時刻 (時)">
              <NumberInput value={draft.startHour} min={0} max={23} onChange={(v) => set("startHour", v)} />
            </Field>
            <Field label="終了時刻 (時)">
              <NumberInput value={draft.endHour} min={1} max={24} onChange={(v) => set("endHour", v)} />
            </Field>
            <Field label="表示日数 (先まで)">
              <NumberInput value={draft.daysAhead} min={1} max={60} onChange={(v) => set("daysAhead", v)} />
            </Field>
            <label className="flex items-end justify-between gap-2 pb-1">
              <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">平日のみ</span>
              <span className="relative inline-flex items-center">
                <input
                  type="checkbox"
                  checked={draft.weekdaysOnly}
                  onChange={(e) => set("weekdaysOnly", e.target.checked)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="h-5 w-9 rounded-full bg-gray-200 transition-colors peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/40 dark:bg-zinc-700"
                />
                <span
                  aria-hidden
                  className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4"
                />
              </span>
            </label>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="section-title">出力</h3>
          <div className="space-y-3">
            <Field label="カレンダー ID">
              <TextInput value={draft.calendarId} onChange={(v) => set("calendarId", v)} />
            </Field>
            <Field label="出力テンプレート（{date} {wday} {ranges}）">
              <TextInput value={draft.template} onChange={(v) => set("template", v)} />
            </Field>
            <Field label="範囲区切り">
              <TextInput value={draft.rangeSeparator} onChange={(v) => set("rangeSeparator", v)} />
            </Field>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="section-title">ショートカット</h3>
          <Field label="グローバルショートカット">
            <ShortcutRecorder value={draft.shortcut} onChange={(v) => set("shortcut", v)} />
          </Field>
        </section>

        {error && <p className="alert-error">{error}</p>}
      </div>

      <div className="flex flex-none justify-end gap-2 border-t border-gray-100 bg-white/90 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <button type="button" onClick={onClose} className="btn btn-ghost px-3 py-2">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} className="btn btn-primary px-4 py-2">
          保存
        </button>
      </div>
    </div>
  );
}

const PROVIDER_GLYPHS: Record<ProviderId, ReactNode> = {
  google: <GoogleGlyph size={15} />,
  microsoft: <MicrosoftGlyph size={13} />,
  apple: <AppleGlyph size={15} className="text-gray-900 dark:text-zinc-100" />,
};

function ProviderRow({
  provider,
  label,
  connected,
  busy,
  disabled,
  error,
  onConnect,
  onDisconnect,
}: {
  provider: ProviderId;
  label: string;
  connected: boolean | null;
  busy: boolean;
  disabled: boolean;
  error: string | undefined;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="space-y-1 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 flex-none items-center justify-center rounded-md bg-gray-50 ring-1 ring-gray-200/70 dark:bg-zinc-800 dark:ring-zinc-700">
          {PROVIDER_GLYPHS[provider]}
        </span>
        <span className="flex-1 truncate text-xs font-medium text-gray-800 dark:text-zinc-100">
          {label}
        </span>
        {connected === true && (
          <span className="flex flex-none items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            接続済み
          </span>
        )}
        {connected === true ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="btn btn-ghost px-2 py-1 text-[11px]"
          >
            解除
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy || disabled}
            className="btn btn-secondary px-2.5 py-1 text-[11px]"
          >
            {busy ? "連携中…" : "連携する"}
          </button>
        )}
      </div>
      {disabled && (
        <p className="pl-8 text-[10px] text-red-600 dark:text-red-400">
          {provider === "google"
            ? "VITE_GOOGLE_CLIENT_ID が未設定"
            : "VITE_MICROSOFT_CLIENT_ID が未設定"}
        </p>
      )}
      {error && <p className="pl-8 text-[10px] text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-gray-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input tabular-nums"
    />
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input"
    />
  );
}
