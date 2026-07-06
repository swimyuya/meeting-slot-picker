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
    <div className="flex animate-fade-in items-center gap-2 border-b border-brand-100 bg-gradient-to-r from-brand-50 to-indigo-50 px-3 py-1.5 text-xs dark:border-brand-900/40 dark:from-brand-950/40 dark:to-indigo-950/40">
      <span className="flex-1 text-brand-900 dark:text-brand-200">
        ✨ 新しい版があります (v{version})
        {error && <span className="ml-2 text-red-600 dark:text-red-400">— {error}</span>}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={onApply}
        className="btn btn-primary px-2.5 py-1"
      >
        {busy ? "更新中…" : "今すぐ更新"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        disabled={busy}
        className="btn btn-ghost px-2 py-1 text-brand-700 dark:text-brand-300"
      >
        後で
      </button>
    </div>
  );
}
