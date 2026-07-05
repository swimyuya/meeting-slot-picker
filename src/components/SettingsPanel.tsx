import { useState, type ReactNode } from "react";
import type { ProviderId } from "../auth/providers";
import type { useProviderStatus } from "../hooks/useProviderStatus";
import { AppConfigSchema, type AppConfig } from "../lib/config";
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
    <div className="flex-1 space-y-3 overflow-auto p-4 text-xs">
      <SubscriptionBadge status="beta" />

      <h2 className="text-sm font-semibold text-gray-800">設定</h2>

      {providerStatus && configMissing && (
        <section className="space-y-2 rounded border border-gray-200 p-3">
          <h3 className="text-xs font-semibold text-gray-700">連携状態</h3>
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
        </section>
      )}

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
        <Field label="平日のみ">
          <input
            type="checkbox"
            checked={draft.weekdaysOnly}
            onChange={(e) => set("weekdaysOnly", e.target.checked)}
            className="h-4 w-4"
          />
        </Field>
      </div>

      <Field label="カレンダー ID">
        <TextInput value={draft.calendarId} onChange={(v) => set("calendarId", v)} />
      </Field>
      <Field label="出力テンプレート（{date} {wday} {ranges}）">
        <TextInput value={draft.template} onChange={(v) => set("template", v)} />
      </Field>
      <Field label="範囲区切り">
        <TextInput value={draft.rangeSeparator} onChange={(v) => set("rangeSeparator", v)} />
      </Field>
      <Field label="グローバルショートカット">
        <ShortcutRecorder value={draft.shortcut} onChange={(v) => set("shortcut", v)} />
      </Field>

      {error && <p className="text-red-600">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded border border-gray-300 px-3 py-1.5">
          キャンセル
        </button>
        <button type="button" onClick={handleSave} className="rounded bg-brand px-3 py-1.5 font-medium text-white">
          保存
        </button>
      </div>
    </div>
  );
}

function ProviderRow({
  provider: _provider,
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
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-700">
          {connected === true ? "✓ " : "・ "} {label}
        </span>
        {connected === true ? (
          <button
            type="button"
            onClick={onDisconnect}
            disabled={busy}
            className="rounded border border-gray-300 px-2 py-1 text-[11px] hover:bg-gray-50 disabled:opacity-40"
          >
            解除
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            disabled={busy || disabled}
            className="rounded bg-gray-800 px-2 py-1 text-[11px] text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {busy ? "連携中…" : "連携する"}
          </button>
        )}
      </div>
      {disabled && (
        <p className="text-[10px] text-red-600">
          {_provider === "google"
            ? "VITE_GOOGLE_CLIENT_ID が未設定"
            : "VITE_MICROSOFT_CLIENT_ID が未設定"}
        </p>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-gray-500">{label}</span>
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
      className="rounded border border-gray-300 px-2 py-1"
    />
  );
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-gray-300 px-2 py-1"
    />
  );
}

