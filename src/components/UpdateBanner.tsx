interface Props {
  version: string;
  busy: boolean;
  error: string | null;
  onApply: () => void;
  onDismiss: () => void;
}

/** 新版アップデート通知バー。ヘッダ直下に表示。 */
export function UpdateBanner({ version, busy, error, onApply, onDismiss }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs">
      <span className="flex-1 text-amber-900">
        新しい版があります (v{version})
        {error && <span className="ml-2 text-red-700">— {error}</span>}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onApply}
        className="rounded bg-amber-600 px-2 py-1 font-medium text-white disabled:opacity-50"
      >
        {busy ? "更新中…" : "今すぐ更新"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={busy}
        className="rounded px-2 py-1 text-amber-700 hover:bg-amber-100"
      >
        後で
      </button>
    </div>
  );
}
