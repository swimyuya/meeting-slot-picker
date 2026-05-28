/**
 * Chrome 拡張機能 Service Worker (Manifest V3)。
 *
 * 最小実装: chrome.commands の `_execute_action` は Chrome が自動でポップアップを
 * 開いてくれるので、ここでハンドラを書く必要はない。
 *
 * 将来的に下記の用途で拡張可能:
 *   - chrome.alarms で定期的にカレンダー fetch (今回は popup 起動時のみで十分)
 *   - chrome.notifications で予定リマインダー
 *   - chrome.contextMenus でテキスト選択から日程テキスト生成
 *
 * 何も export しない (起動時に副作用として登録するだけ)。
 */

// 拡張機能インストール時 / 更新時に何かやるなら下記。
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // 初回インストール時: なにもしないが、ログだけ残す
    console.log("[meeting-slot-picker] installed");
  }
});
