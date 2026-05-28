import { useState } from "react";

interface Props {
  preview: string;
  count: number;
  loading: boolean;
  error: string | null;
  /** freeBusy で取得した予定件数 (表示範囲内)。 */
  busyCount?: number;
  onCopy: () => Promise<void>;
  onClear: () => void;
  onReload: () => void;
  onSettings: () => void;
  onDisconnect: () => void;
}

/** 下部ツールバー: プレビュー・コピー・クリア・再取得・設定・連携解除。 */
export function Toolbar({
  preview,
  count,
  loading,
  error,
  busyCount = 0,
  onCopy,
  onClear,
  onReload,
  onSettings,
  onDisconnect,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await onCopy();
      setCopyError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="space-y-2 border-t bg-gray-50 p-2">
      <textarea
        readOnly
        value={preview}
        aria-label="コピー内容プレビュー"
        placeholder="空き枠を選択するとここに表示されます"
        className="h-16 w-full resize-none rounded border border-gray-200 bg-white p-2 text-xs leading-5"
      />
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          disabled={count === 0}
          onClick={handleCopy}
          className="rounded bg-brand px-3 py-1.5 font-medium text-white disabled:opacity-40"
        >
          {copied ? "コピーしました ✓" : `コピー（${count}枠）`}
        </button>
        <button
          type="button"
          disabled={count === 0}
          onClick={onClear}
          className="rounded border border-gray-300 px-2 py-1.5 disabled:opacity-40"
        >
          クリア
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={onReload}
          className="rounded border border-gray-300 px-2 py-1.5 disabled:opacity-40"
        >
          {loading ? "更新中…" : "再取得"}
        </button>
        <span
          className="text-[10px] text-gray-400"
          title="freeBusy で取得した表示範囲内の予定件数"
        >
          予定 {busyCount} 件
        </span>
        <div data-tauri-drag-region className="flex-1 cursor-grab active:cursor-grabbing" title="ドラッグして移動" />
        <button type="button" onClick={onSettings} className="rounded px-2 py-1.5 text-gray-600 hover:bg-gray-200">
          設定
        </button>
        <button type="button" onClick={onDisconnect} className="rounded px-2 py-1.5 text-gray-600 hover:bg-gray-200">
          連携解除
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {copyError && <p className="text-xs text-red-600">コピーに失敗しました: {copyError}</p>}
    </div>
  );
}
