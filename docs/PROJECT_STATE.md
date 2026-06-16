# プロジェクト状態 (PROJECT_STATE)

> **このファイルの役割**
> セッションを跨いで引き継ぎたい「文脈・背景・進行状態」をここに集約する。
> ルート `CLAUDE.md` から `@docs/PROJECT_STATE.md` で import しているため、
> **新しい Claude Code セッションを起動するたびに、このファイルは自動で読み込まれる。**
> 長寿命セッションを探して復帰する必要はない。背景はここに常駐させる。
>
> **更新タイミング**: 区切りのよい作業完了時・方針決定時・ブランチ切替時、または
> ユーザーが「状態保存」と言ったら、その時点の最新状態でこのファイルを上書きする。
> 古い情報は消す前に「履歴 / 完了済み」へ畳む。


最終更新: 2026-06-16

---

## 0. このリポジトリの正本

- 正本 = `~/dev-projects/meeting-slot-picker/`
- リモート: https://github.com/swimyuya/meeting-slot-picker

## 背景・前提（ユーザー作成・セッション横断）

- **目的 / ゴール**: カレンダーの予定を重ねた週グリッドで空き枠（30分単位）を選ぶと「5/23（水）10:00-11:00 / 13:00-13:30」形式の日程調整テキストがクリップボードに入る。メール・LINE にそのまま貼れる（README）。`Ctrl+Shift+U`（macOS は ⌘+Shift+U）でどこからでも開けるメニューバー常駐アプリ。
- **対象ユーザー**: 主に自分用＋配布対象者。利用には配布者（メンテナ）が GCP の test users に各自の Gmail を追加する必要があり、上限 100 名（README / [[project-meeting-slot-picker]]）。
- **確定した方針・決定**:
  - 「Pro 版」= Google + Outlook + Apple Calendar (iCloud) の 3 連携対応版。Google のみの旧「日程ピッカー」は別 repo / 別配布で並行運用（README）。
  - 現状は **Free Pro Beta**（全機能無料）。将来サブスク化（Stripe + license check）予定だが未実装で、`pro:user_email` 保存・`X-Subscriber-Email` ヘッダ等の地ならしのみ済み（docs/subscription-roadmap.md）。
  - 配布形態は macOS Tauri ネイティブ / iPhone・iPad PWA (https://meeting-slot-picker.vercel.app) / Chrome 拡張機能 (Manifest V3) の 3 形態。
  - OAuth 同意画面は 2026-06-11 に **本番公開済み**（機微スコープ refresh_token の 7 日失効対策、[[project-meeting-slot-picker]]）。
  - macOS 版は `/Applications` インストール + LaunchAgent（`com.unveil.meeting-slot-picker-pro`, KeepAlive）で常駐自動起動（[[project-meeting-slot-picker]]）。
  - Google 連携失効（`invalid_grant`）時の**自動再連携**を実装（2026-06-16）: `token.ts` の `TokenRefreshError`(invalidGrant フラグ) + `isAuthExpiredError()` → `useBusyTimes` が失効検知時に `useProviderStatus.markExpired(provider)` を呼び、失効トークン破棄 + connected=false + 「要再連携」表示。Google 単独なら ConnectPrompt（ワンクリック再連携）に自動切替。本番公開（7日失効解消）の保険。vitest 198 緑 / tsc 0。**コミット済み**（`feat(auth): detect invalid_grant ...`、feature/pro、未push）（[[project-meeting-slot-picker]]）。
- **制約・前提**:
  - 表示は **日本時間 (JST / Asia/Tokyo) 固定**、カレンダーは既定 `primary`、すべて**読み取り専用**（README）。
  - macOS 版は Apple Developer ID 未取得＝**無署名配布**、初回のみ右クリック→開くが必要（README / [[project-meeting-slot-picker]]）。
  - refresh_token は macOS Keychain（service `com.unveil.meeting-slot-picker`） / Web 版は IndexedDB に保存。
- **重要な gotcha / 注意**:
  - ショートカット既定値は **⌘+Shift+U（macOS）**。コード内コメント・トレイ tooltip の "Ctrl+Shift+U" は誤記（[[project-meeting-slot-picker]]）。
  - Tauri v2 はフロントを Rust バイナリに brotli 埋め込みするため `.app` 内に `.js` は無い → 反映確認は `dist/` を grep ＋バイナリ mtime で判定（[[project-meeting-slot-picker]]）。
  - iOS Safari は 7 日未使用で IndexedDB をクリア（Apple ITP）→ 再連携で復旧。Vercel preview URL は deployment protection で 401（[[project-meeting-slot-picker]]）。
  - 再ビルド時の `cc` shim 問題は [[reference-cc-shim-shadows-compiler]] 参照。

## 1. 現在のフォーカス

- 作業ブランチ: `feature/pro`
- 直近コミット: ab18ea2 fix(extension): popup の高さを !important で固定 (グリッド非表示問題) (2026-05-29)
- 直近コミット: `feat(auth): detect invalid_grant and auto-prompt reconnect`（invalid_grant 自動再連携、src 4 + test 3 + 本ファイル、2026-06-16）
- 未コミット: 1 件（`meeting-slot-picker-pro-extension-0.1.0.zip` ＝ ビルド成果物のみ。意図的に未コミット）/ 未push: 2 件  ← 次セッションで最初に確認。push はユーザー指示待ち

## 2. これまでの大きな流れ（直近コミット）

- ab18ea2 fix(extension): popup の高さを !important で固定 (グリッド非表示問題)
- 2fd67c2 fix(extension): OAuth フローを background SW で実行 (popup 閉じ対策)
- 0e9542f fix(apple): map 'principalUrl' error to 401 (iCloud auth rejection)
- bd7de56 fix(apple): use createRequire to bypass tsdav dual-package hazard
- ce21549 fix(apple): cleaner namespace import fallback typing
- 4a9e71a fix(apple): namespace import + fallback for tsdav (Vercel CJS interop)
- fa869a7 fix(apple): tsdav v2 は createDAVClient 関数を使う
- 10a0292 feat(pro): Apple Calendar (iCloud CalDAV) 連携を追加
- a6e5cf9 fix(mobile): 2本指ピンチズームを許可
- e51f5b8 chore: untrack .vercel-google-only-backup (vercel cli internal)
- 97f06b2 fix(CallbackPage): provider 名を sessionStorage から動的に表示
- 327352d security: 多層防御の強化 (security review 反映)
- 02a8db3 feat(pro): 「日程ピッカー Pro」 — Google + Outlook 対応版を別ブランドで構築
- 5bf4d8d chore(extension): publicDir=false で PWA 用ファイルを除外
- 98f8ffe feat: Windows 用 Chrome 拡張機能 (Manifest V3)
- cd3377c fix(SlotCell): touch で縦スクロール / 横スワイプ時に誤選択しない
- d68b328 fix(api): use .js extensions in ESM imports + add .vercelignore
- 1c149ae feat: PWA support for iPhone (Web build + Vercel API backend)
- 0ff56c9 ci: post-build step to sign artifact and upload latest.json + .sig
- 371be46 fix(ci): pass GITHUB_TOKEN to tauri-action for release creation

## 3. このプロジェクトは何か

- 技術: Node, Rust/Tauri
- README 抜粋:

```
# 日程ピッカー Pro (Meeting Slot Picker Pro)

> **Google + Outlook + Apple Calendar 対応版** — 既存「日程ピッカー」(Google のみ) は別 repo / 別配布で並行運用中。**Pro 版はこちら**。
>
> 🎁 **Free Pro Beta** — 全機能ご利用いただけます。将来サブスク化予定 ([roadmap](docs/subscription-roadmap.md))。

`Ctrl+Shift+U` でどこからでも開けるメニューバー常駐アプリ + **iPhone / iPad の PWA** + **Chrome 拡張機能**。Google カレンダーと Outlook と Apple Calendar の予定を重ねた週グリッドで空き枠（30分単位）を選ぶと、日程調整用のテキストがクリップボードに入る。

```
5/23（水）10:00-11:00 / 13:00-13:30
5/24（木）14:00-16:00
```

## 4. 既知の注意点 / gotcha

- （特記事項は作業中に追記）

## 5. 次にやること / open threads

- （次セッションで具体化。未コミット / 未push があれば最優先で確認）

## 6. 履歴 / 完了済み

- 2026-06-16: `~/dev-projects/` 配下へ移動し、セッション跨ぎメモリ (PROJECT_STATE) を整備。
