# セキュリティポリシー — 日程ピッカー Pro

## 報告

セキュリティ脆弱性を発見した場合、公開 issue を立てる前に
**unveiljapan0@gmail.com** までご連絡ください。

## 信頼境界・設計の前提

このアプリは「**ユーザー自身のカレンダー** を読み取り、**ユーザーの端末** で空き枠を選んで
**ユーザーのクリップボード** に出力する」という、すべて user-owned なフローを担います。
そのため信頼境界は以下のとおりです。

```
┌─────────────────────────────────────────────────────────────────┐
│  信頼境界: ユーザーの端末                                          │
│                                                                  │
│  ┌──────────────────┐    ┌──────────────────┐                  │
│  │  Tauri アプリ     │    │  PWA / 拡張機能   │                  │
│  │  - Keychain       │    │  - IndexedDB     │                  │
│  │  - loopback OAuth │    │  - chrome.storage│                  │
│  └────────┬─────────┘    └────────┬─────────┘                  │
│           │ refresh_token        │ refresh_token (Web 経路)     │
└───────────┼──────────────────────┼────────────────────────────────┘
            │                       │
            ▼                       ▼
   Google / MS token endpoint   Vercel Function (/api/auth/*)
   (Tauri の場合直接)              ▼
                                Google / MS token endpoint
                                (client_secret はサーバのみ)
```

## 実装している対策

### OAuth / トークン
- **PKCE (S256)** で code injection を防ぐ。verifier は 48 bytes (384 bits) の暗号学的乱数
- **state パラメータ** は 32 bytes (256 bits) で CSRF 対策
- **refresh_token** は provider 別キーで保存:
  - Tauri: macOS Keychain (`keyring` crate)
  - Chrome 拡張: `chrome.storage.local`
  - PWA: IndexedDB (origin 隔離)
- Tauri 経路は Google / Microsoft の token endpoint に直接 POST。Web / 拡張機能は
  Vercel Function 経由で **client_secret をブラウザに出さない**
- Microsoft の **rotating refresh_token** に対応 (新しいものが返ったら再保存)
- `id_token` の **DoS 対策 (8KB 上限)** + JSON parse 失敗時は null 返却

### API バックエンド (Vercel Function)
- **CORS allowlist** は `ALLOWED_ORIGIN` / `VERCEL_URL` / `EXTENSION_ID` env のみ許可
  - 任意の `*.vercel.app` ワイルドカード許可は **禁止** (誰でも作成可能なため)
  - 任意の `chrome-extension://*` ワイルドカード許可も **禁止**
- **redirect_uri allowlist** で OAuth code injection を多層防御
  (`ALLOWED_REDIRECT_URIS` env + loopback パターン)
- **Zod** で全 body をスキーマ検証
- エラーレスポンスは汎用メッセージのみ (内部詳細を露出しない)
- ログには例外 message のみ記録 (例外オブジェクト全体ではない)

### Tauri Rust 側
- **`auth_url` ホスト検証**: `oauth_capture_code` コマンドは
  `https://accounts.google.com/` / `https://login.microsoftonline.com/` で始まる
  URL のみ受理 (XSS 経由の任意 URL オープン防止)
- Keychain サービス名は **bundle identifier と一致**
- HTTP capabilities は **Google / Microsoft の必要なエンドポイントのみ** 許可
- 認可コードのキャプチャは **127.0.0.1 ループバック** (localhost ではなく)、
  state を Rust 側でも検証

### フロントエンド
- React は `{}` 内を textContent として扱うため XSS には強い
- `dangerouslySetInnerHTML` を **使用していない**
- エラーメッセージは Callback ページで **分類してから表示** (内部詳細を直接 DOM に流さない)
- Service Worker は `oauth2.googleapis.com` (token endpoint) を **キャッシュ対象から除外**
- IndexedDB / chrome.storage / sessionStorage 内の値は user が制御するもののみで、
  攻撃者注入の経路はない

### Chrome 拡張機能
- Manifest V3 の **デフォルト CSP** (`script-src 'self'`) が自動適用される
- `host_permissions` は Google / Microsoft / Vercel API の必要分のみ
- `permissions` は `storage` と `identity` の最小限

## 既知の限界・受容しているリスク

1. **Tauri ビルドの `client_secret` 焼き付き**: Google Desktop / Azure SPA client
   の secret は OAuth 規格上 "non-confidential" と定義されている (PKCE で補完)。
   ただし配布バンドルから抽出可能なため、漏洩した場合は GCP / Azure で
   client secret をローテートして次回 release に反映する必要がある。

2. **Vercel Function のレート制限**: 現状アプリケーションレベルのレート制限なし。
   Vercel プラットフォームの制限のみで運用。トラフィック増加時に
   `@upstash/ratelimit` 等の導入を検討する。

3. **無署名配布の macOS Tauri アプリ**: Apple Developer ID で署名していないため
   初回起動時に「右クリック→開く」が必要。配布インフラへの整備で対応中。

4. **Chrome 拡張機能のグローバルショートカット**: `chrome://extensions/shortcuts`
   で user 自身が "Global" を選択する必要あり (Chrome の制限)。

## 報告された問題と対処

過去のセキュリティ修正は git log で確認可能。重大な脆弱性は CHANGELOG に追記。
