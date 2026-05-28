# 日程ピッカー Pro (Meeting Slot Picker Pro)

> **Google + Outlook 対応版** — 既存「日程ピッカー」(Google のみ) は別 repo / 別配布で並行運用中。**Pro 版 (Outlook 連携あり) はこちら**。
>
> 🎁 **Free Pro Beta** — 全機能ご利用いただけます。将来サブスク化予定 ([roadmap](docs/subscription-roadmap.md))。

`Ctrl+Shift+U` でどこからでも開けるメニューバー常駐アプリ + **iPhone / iPad の PWA** + **Chrome 拡張機能**。Google カレンダーと Outlook の予定を重ねた週グリッドで空き枠（30分単位）を選ぶと、日程調整用のテキストがクリップボードに入る。

```
5/23（水）10:00-11:00 / 13:00-13:30
5/24（木）14:00-16:00
```

メール・LINE での日程提案にそのまま貼り付けられる。

## 特徴

- **グローバルショートカット**（既定 `Ctrl+Shift+U`、設定で変更可）でポップアップをトグル
- **メニューバー常駐**（Dock アイコンなし、トレイクリックでも開閉可）
- **Google カレンダー + Outlook 連携** — 両方同時に繋いで予定を合算表示 (薄いグレー=Google / 薄い水色=Outlook)。読み取り専用
- **重なる予定もすべて表示** — カレンダー風の縦バーで時間幅が一目で分かる、終日予定は終日ストリップに名前付きで表示
- **クリック／ドラッグで複数選択** — 連続枠は自動結合、日付ごとに集約してコピー
- refresh_token は **OS キーチェーン** に保存（設定ファイルには秘密情報を置かない）
- **自動アップデート** — 新版が出たらアプリ内通知 → 1クリックで更新

## 動作環境

- **macOS 版**: macOS 11 (Big Sur) 以上 / Intel・Apple Silicon どちらも対応 (Universal Binary)
- **Windows 版 (Chrome 拡張機能)**: Chrome / Edge / Brave / Opera など Chromium 系ブラウザ
- **Web 版 (PWA)**: iOS / iPadOS Safari、最新の Chrome / Edge / Firefox。「ホーム画面に追加」でアプリ風に常駐可能

## インストール（エンドユーザー向け）

### 1. 利用申請

Google カレンダー読み取り権限を使うため、配布者（メンテナ）に**あなたの Google アカウントのメールアドレス**を伝えてください。GCP のテストユーザーに追加されないと、連携時に `access_denied` になります。

### 2. ダウンロードとインストール

1. [Releases ページ](https://github.com/swimyuya/meeting-slot-picker/releases/latest) から `Meeting Slot Picker_<version>_universal.dmg` をダウンロード
2. `.dmg` を開き、`Meeting Slot Picker.app` を **Applications** フォルダにドラッグ

### 3. 初回起動（無署名警告の突破）

このアプリは Apple Developer ID で署名していないため、初回起動時に macOS の警告が出ます。次の手順で開いてください：

1. Finder で `Applications` → `Meeting Slot Picker.app` を **右クリック**
2. 「**開く**」を選択
3. 「開発元を検証できません。本当に開いてもよろしいですか？」というダイアログで「**開く**」をクリック

以降は通常の起動（Spotlight や Dock）で OK です。

### 4. 連携と利用開始

1. メニューバーにアイコンが出ます
2. **`Ctrl+Shift+U`** または **トレイアイコンクリック** でポップアップが開く
3. 「**Google と連携する**」→ ブラウザで同意 → アプリに戻る
4. グリッドに自分の予定が重なって表示される → 空き枠をクリック／ドラッグで選択 → **「コピー（N 枠）」** → 任意のテキストアプリに貼り付け

## Windows / Chrome 拡張機能版の使い方

### 1. Chrome Web Store からインストール

[Chrome Web Store の日程ピッカーページ](https://chrome.google.com/webstore/detail/<extension-id>)
→ **「Chrome に追加」** をクリック → **「拡張機能を追加」** で完了

> Edge / Brave / Opera 等の Chromium 系ブラウザでも、Chrome Web Store の拡張機能をインストールできます。

### 2. ツールバーにピン留め（推奨）

- ツールバーの **パズルピース** をクリック → 「日程ピッカー」の **ピン**アイコンをクリック → ツールバーに常設

### 3. グローバルショートカットを有効化（推奨）

既定の `Ctrl+Shift+U`（macOS は `Command+Shift+U`）は **Chrome がフォーカスされているときのみ** 効きます。OS 全体で効くようにするには:

1. アドレスバーに `chrome://extensions/shortcuts` を入力
2. 「日程ピッカー」の「日程ピッカーのポップアップを開く」の右側ドロップダウンで **「グローバル」** を選択

これで他のアプリを使っているときでも、ショートカットで呼び出せます。

### 4. 連携と利用開始

1. ツールバーアイコン or `Ctrl+Shift+U` でポップアップが開く
2. 「**Google と連携する**」→ Google の同意画面（Chrome ポップアップ内に表示） → 戻ってきたら連携完了
3. 30 分枠をクリック / ドラッグで選択 → 「**コピー（N 枠）**」→ メール / LINE に貼り付け

### 既知の制約

- iOS Safari / Firefox ではインストール不可（iOS は PWA、macOS ネイティブが好みなら .dmg を利用）。
- グローバルショートカット既定値が他アプリと競合する場合は `chrome://extensions/shortcuts` から自由に変更可能。

---

## iPhone / Web 版の使い方

### 1. URL を開く

ブラウザで `https://meeting-slot-picker.vercel.app` を開く。

### 2. ホーム画面に追加（推奨）

iPhone Safari の場合:
1. 共有ボタン（□↑）→ **「ホーム画面に追加」**
2. アイコンから起動するとブラウザ UI が消えてアプリ風に動く

### 3. Google と連携

「**Google と連携する**」→ Safari が同意画面を開き、戻ってくると連携完了。トークンは IndexedDB に保存（端末を超えて共有はしない）。

### 4. 操作

- 上部の **日付チップ**（今日/明日/曜日…）または **左右の矢印** で日を切り替え
- 横スワイプでも前後の日に移動
- 30分セルをタップして選択（複数日にまたがる選択も可）
- 「**コピー（N枠）**」→ クリップボードに入る → メモ / メール / LINE に貼り付け

### 既知の制約（Web 版）

- iOS Safari は **7 日間アクセスがないと IndexedDB をクリア**する場合があります（Apple ITP）。再連携で復旧。
- Web 用 OAuth クライアントの test users（最大 100 名）への追加がメンテナ側で必要。
- グローバルショートカット・自動アップデートは Web 版にはありません（macOS 版のみ）。

### 5. 設定変更

ポップアップ右下の「**設定**」から以下を変更できます：

- 表示時間帯（開始/終了時刻）
- 表示日数（先何日まで）
- 平日のみ表示するか
- 出力テンプレート（`{date}（{wday}）{ranges}` のフォーマット）
- **グローバルショートカット**（「変更」ボタン → 新しいキー組合せを押す）

## 自動アップデート

起動後に新版が公開されていると、ヘッダ直下に「**新しい版があります**」バーが表示されます。「今すぐ更新」で適用 → 自動で再起動します。

## 既知の制限

- **無署名配布**: 初回のみ右クリック→開くが必要（上記手順 3）
- **GCP テストユーザー登録が必要**: メンテナが test users に追加するまで連携できない（上限 100 名）
- **カレンダーは `primary` 既定**: 設定で他のカレンダー ID に変更可
- **日本時間 (JST) 固定**: 表示は Asia/Tokyo 前提

## トラブルシューティング

- **起動できない（"開発元未確認"）** → 上記手順 3 の右クリック→開く
- **連携ボタンが押せない / `access_denied`** → メンテナにテストユーザー追加を依頼
- **予定が表示されない** → 「再取得」ボタン or アプリ再起動。表示時間帯外の予定は自動拡張でカバーされるが、極端に早朝/深夜の予定は設定で時間範囲を広げる
- **ショートカットが効かない** → 他アプリと競合している可能性 → 設定で別の組合せに変更

---

## 開発者向け

### 技術スタック

Tauri v2 + React 19 + Vite + TypeScript + Tailwind CSS。ネットワークは `tauri-plugin-http`（Rust 経由で CORS 回避）。OAuth は自前のループバック（`127.0.0.1`、RFC 8252）で受け、PKCE で token 交換。

### セットアップ

```bash
npm install
cp .env.example .env.local
# .env.local を編集: VITE_GOOGLE_CLIENT_ID と VITE_GOOGLE_CLIENT_SECRET を設定
```

### 開発・テスト

```bash
npm run tauri:dev                                 # アプリ起動
npm run tauri:build -- --target universal-apple-darwin   # 配布ビルド

npm test                                          # 単体・結合 (vitest)
npm run coverage                                  # カバレッジ (閾値 80%)
npm run build                                     # 型チェック + Vite ビルド
npm run e2e                                       # Playwright (Web UI 層)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust ユニット
```

### プロジェクト構成

```
src/
  domain/      slots / selection / formatter / selectors / dayLayout
  calendar/    token / events / freebusy / types
  auth/        oauth (loopback + PKCE)
  lib/         time / config / secrets / http / clipboard / env / tauri / error
  hooks/       useConfig / useAuthStatus / useBusyTimes / useSelection / useShortcut / useUpdater
  components/  WeekGrid / SlotCell / Toolbar / SettingsPanel / ConnectPrompt / UpdateBanner
  App.tsx
src-tauri/
  src/lib.rs       トレイ・ウィンドウ配置・グローバルショートカットハンドラ・各プラグイン登録
  src/commands.rs  Keychain (keyring) コマンド・OAuth ループバック
.github/workflows/release.yml  tag push で自動ビルド・署名・GitHub Release
scripts/sync-version.mjs       package.json → Cargo.toml / tauri.conf.json のバージョン同期
```

### セキュリティ

- refresh_token は macOS Keychain（service `com.unveil.meeting-slot-picker`）に保存
- `http` capability は `oauth2.googleapis.com` と `www.googleapis.com` に限定
- カレンダーは読み取り専用（予定の作成・変更はしない）

### リリース

メンテナ向けのリリース手順は [RELEASE.md](RELEASE.md) を参照。
