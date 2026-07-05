/**
 * ショートカット spec ("CmdOrControl+Shift+KeyU" 等) の表示整形。
 *
 * 2 つの表示形式は**意図的に別物** (出力が異なるため統一しない):
 *   - formatShortcutForDisplay: 設定画面用 "Ctrl + Shift + U" (空白区切り・Digit/Arrow も変換)
 *   - formatShortcutCompact:    ヘッダ用 "Ctrl+Shift+U" (無空白・最小限の置換)
 */

/** "Control+Shift+KeyU" 形式を表示用 "Ctrl + Shift + U" に整形。 */
export function formatShortcutForDisplay(spec: string): string {
  if (!spec) return "(未設定)";
  return spec
    .split("+")
    .map((s) => {
      if (s === "Control" || s === "Ctrl" || s === "CmdOrControl") return "Ctrl";
      if (s === "Cmd" || s === "Meta" || s === "Super") return "⌘";
      if (s === "Alt" || s === "Option") return "Alt";
      if (s === "Shift") return "Shift";
      if (s.startsWith("Key")) return s.slice(3);
      if (s.startsWith("Digit")) return s.slice(5);
      if (s.startsWith("Arrow")) return s.replace("Arrow", "");
      return s;
    })
    .join(" + ");
}

/** ヘッダ表示用のコンパクト整形 "Ctrl+Shift+U" (旧 App.tsx インライン実装)。 */
export function formatShortcutCompact(spec: string): string {
  return spec
    .replace("CmdOrControl", "Ctrl")
    .replace("Control", "Ctrl")
    .replace("Cmd", "⌘")
    .replace(/Key([A-Z])/g, "$1");
}
