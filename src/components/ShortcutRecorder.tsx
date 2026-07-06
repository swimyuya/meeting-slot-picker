import { useEffect, useState } from "react";
import { formatShortcutForDisplay } from "../lib/shortcut-format";

/** ショートカット入力: 「変更」ボタン押下で次のキー組合せを記録し Tauri spec 形式で保存。 */
export function ShortcutRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      // 修飾キー単独は無視 (組合せの完成を待つ)
      if (["Control", "Meta", "Alt", "Shift", "OS"].includes(e.key)) return;
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Control");
      if (e.metaKey) parts.push("Cmd");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (parts.length === 0) return; // 修飾キー無しは誤発火しやすいので拒否
      parts.push(e.code); // 例: "KeyU" (レイアウト非依存)
      onChange(parts.join("+"));
      setRecording(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [recording, onChange]);

  return (
    <div className="flex items-center gap-2">
      <code
        aria-label="現在のショートカット"
        className={`flex-1 rounded-lg border px-2.5 py-1.5 font-mono text-[11px] transition-colors ${
          recording
            ? "border-brand bg-brand-50 text-brand-700 dark:border-brand-500 dark:bg-brand-500/10 dark:text-brand-300"
            : "border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200"
        }`}
      >
        {recording ? "（キー組合せを押してください・Esc で取消）" : formatShortcutForDisplay(value)}
      </code>
      <button
        type="button"
        onClick={() => setRecording((r) => !r)}
        className="btn btn-secondary px-2.5 py-1.5"
      >
        {recording ? "取消" : "変更"}
      </button>
    </div>
  );
}
