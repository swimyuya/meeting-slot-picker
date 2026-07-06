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


最終更新: 2026-07-06

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
- 2026-07-06: **大規模リファクタ完了**（14 コミット、挙動保存）。全ゲート緑: vitest 234 / tsc 0 / web+extension ビルド / Playwright e2e 5 passed 1 skipped(設計) / ピクセル一致検証済み
  - 重複解消: OAuth 3 フロー→`oauth-core.ts` 共有化 / WeekGrid↔MobileDayView のバー描画→`EventBars.tsx` / api/_lib google↔microsoft→`token-request.ts` / provider→ラベル・色・prefix→`lib/provider-ui.ts` / 資格情報 ternary→`getOAuthClientCredentials`
  - 分割: App.tsx の Tauri メニューバー挙動→`hooks/useTauriMenubar.ts`（blur中連携ガード含む・新規テスト5本）/ SettingsPanel→`ShortcutRecorder.tsx` 抽出 / ショートカット表示 2 形式→`lib/shortcut-format.ts`（**出力が違うので統一していない**）
  - デッドコード削除: connectGoogle / useAuthStatus / events.ts シム / env.ts の意味が食い違う isWebRuntime ほか計 10 シンボル・3 ファイル
  - テスト補強: 198→234（dispatch 分岐 / バーのピクセル pin / api MS 分岐+refresh ハンドラ / scope 同期 / メニューバー挙動）
  - **fix(updater)**: CI が `latest.json` を上げていたが app は `pro-latest.json` をポーリング→CI 側を修正。`VERSION="${TAG#pro-v}"` も修正（旧 `#v` では pro-v タグから剥がれず非 semver になっていた）。RELEASE.md のタグ手順も pro-vX.Y.Z 明記
  - zip はビルド成果物として **untrack 済み**（.gitignore パターンを pro- 対応に修正、package-extension.mjs の出力名も pro- 付きに統一）→「意図的に未コミット」運用は解消
  - e2e の stale アサーション修正（旧 Google 専用版の「Google カレンダーと連携」→ Pro 版 UI 文言。Pro 化以降ずっと落ちていた）
- 2026-07-06 続き: **未テストだった残り4フックにもテスト追加**（useShortcut/useUpdater/useMediaQuery/useHorizontalSwipe、+23本）。vitest **264 緑**・coverage 91.8/84.4/82.5/91.8（functions 80.5%→82.5%で余裕確保）・cargo test 6 緑・CallbackPage もテスト済み（+7本）
  - useShortcut.ts は動的 import をモジュールスコープの promise にメモ化（vitest で同一 callsite の2回目 import がモックを外す quirk 回避。実行時挙動は不変）
  - **6/16 のリポジトリ移動由来の stale Rust ビルドキャッシュ（旧 ~/meeting-slot-picker 絶対パス参照, 9.5GiB）を cargo clean で除去**。放置すると次の cargo build / tauri:dev が確実に失敗する状態だった
- **2026-07-06 push 済み**: リファクタ・テストの 17 コミットを origin/feature/pro へ push（invalid_grant の 2 件は以前に push 済みだった）。ローカルとリモートは同期状態

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

- **Tauri デスクトップ版の Apple 連携到達不能 → 2026-07-06 修正済み**。修正内容: (1) apple-connect.ts の素 fetch を `httpFetch` に変更（Tauri では Rust 側 plugin-http 経由になり webview の CSP/CORS の外。Web/拡張は従来どおりブラウザ fetch）(2) capabilities/default.json の http allowlist に `https://meeting-slot-picker-pro.vercel.app/*` 追加 (3) `tauri:dev` / `tauri:build` npm script と release.yml に `VITE_API_BASE_URL=https://meeting-slot-picker-pro.vercel.app` を明示（デスクトップビルドは同一オリジンが無いので絶対 URL 必須。従来は空でtauri://相対→必ず失敗だった）。CSP connect-src への追加は**不要**（desktop の API 通信は全て plugin-http）。サーバ側 CORS 変更・再デプロイも不要（plugin-http は Origin を送らず、POST は Origin 無しでも処理される）。**Pro の本番 API = meeting-slot-picker-pro.vercel.app**（無印 meeting-slot-picker.vercel.app とは別デプロイ、apple エンドポイントは Pro 側にのみ存在・生存確認済み）
- api/calendar/apple/events は time_min < time_max / 期間上限を未検証（堅牢性の改善余地、未対応）
- トレイ tooltip・コード内コメントの "Ctrl+Shift+U" 誤記は残存（macOS 実際は ⌘+Shift+U）
- リファクタ後の設計メモ: プラットフォーム分岐は `lib/tauri.ts`、OAuth 共有部は `auth/oauth-core.ts`、provider→UI 表現は `lib/provider-ui.ts`、バー描画は `components/EventBars.tsx`（week/day の見た目差は VARIANTS で意図的に保持）。MS の OAuth scope は client/server 二重定義のまま `api/__tests__/scope-sync.test.ts` が同値を強制
- useTauriMenubar（Escape/フォーカスで隠す挙動）は unit テスト済みだが、次回 `npm run tauri:dev` 起動時に手動でも一度確認推奨（jsdom では実フォーカス再現不可）

## 5. 次にやること / open threads

- Apple×デスクトップ修正の実機確認（/Applications 差し替え後、Apple 連携モーダルでダミー資格情報→「パスワードが正しくありません」表示なら配線OK。本物のアプリ用パスワードなら実連携）
- 将来リリース時: pro-vX.Y.Z タグで CI 発火（RELEASE.md 更新済み手順に従う）

## 6. 履歴 / 完了済み

- 2026-06-16: `~/dev-projects/` 配下へ移動し、セッション跨ぎメモリ (PROJECT_STATE) を整備。
