# Azure App Registration 手順 — 日程ピッカー Pro 用

「日程ピッカー Pro」で Outlook (Microsoft 365 / outlook.com) 連携を有効にするため、Azure ポータルでアプリ登録が必要です。**メンテナのみ実施** (エンドユーザーには不要)。

## 所要時間: 10〜15分

## 手順

### 1. Azure ポータルにログイン

https://portal.azure.com

Microsoft アカウント (個人 outlook.com もしくは仕事用 Microsoft 365) でサインイン。

### 2. App registrations を開く

検索バーに「**App registrations**」と入力 → 表示された「App registrations」を選択

### 3. 「+ New registration」

| 項目 | 値 |
|---|---|
| Name | `meeting-slot-picker-pro` |
| Supported account types | **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)** |
| Redirect URI | （ここでは空のまま、次のステップで追加） |

「Register」をクリック。

### 4. Authentication → 「+ Add a platform」

3 つのプラットフォームを追加します。

#### 4-1. Mobile and desktop applications (macOS Tauri 用)

- Custom redirect URIs: `http://localhost:4322`
- 「Configure」

#### 4-2. Single-page application (PWA 用)

- Redirect URIs:
  - `https://meeting-slot-picker-pro.vercel.app/auth/callback`
- 「Configure」

#### 4-3. Single-page application (Chrome 拡張機能用)

「+ Add URI」で SPA プラットフォームに追加:

- `https://<extension-id>.chromiumapp.org/`
  - `<extension-id>` は Chrome Web Store 公開後に確定（32文字、a-p のみ）
  - **本番公開後に追記** する想定。dev 中は「load unpacked」時の id を仮で追加

「Configure」（もしくは「Save」）

### 5. Authentication → Advanced settings

- **Allow public client flows** を **Yes** にして「Save」
  - Tauri の loopback (`http://localhost`) は public client 扱いになるため必要

### 6. Certificates & secrets → 「+ New client secret」

| 項目 | 値 |
|---|---|
| Description | `pro-prod-v1` |
| Expires | 24 months (推奨) |

→ 「Add」

**重要**: 表示された **Value** (`Mxw8Q~...` のような形式) をその場でコピー。**この画面を離れると 2 度と表示されません**。

### 7. API permissions → 「+ Add a permission」

「Microsoft Graph」→「Delegated permissions」を選択:

- ✓ `User.Read` (既定で入っている)
- ✓ **`Calendars.Read`** (カレンダー読取)
- ✓ **`offline_access`** (refresh_token 取得に必須)
- ✓ `email` (id_token に email を含める)
- ✓ `openid` (id_token を返してもらう)
- ✓ `profile`

「Add permissions」

> 個人アカウント (outlook.com) は admin consent 不要で即時利用可。組織テナントによっては管理者承認が必要なケースがあるが、user 自身がテナント管理者なら問題なし。

### 8. メンテナに共有する 2 つの値

「Overview」ページで以下 2 つを取得:

1. **Application (client) ID** — 例: `4d8e9a7b-1234-...`
2. **Client secret value** — Step 6 でコピーした文字列

これを私 (Claude) に共有してください。Vercel の env (`VITE_MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`) に設定して再デプロイします。

### 9. Chrome 拡張機能 公開後の追加作業

Chrome Web Store で「日程ピッカー Pro」拡張機能が公開されると、Chrome が固有の `<extension-id>` を割り当てます。その id を私に教えていただければ、Azure の SPA Redirect URIs に `https://<extension-id>.chromiumapp.org/` を追加します。

---

## トラブルシューティング

### `AADSTS50011: The reply URL specified in the request does not match the reply URLs configured for the application.`

→ 該当の redirect URI が Authentication に登録されていない。Step 4 を再確認。

### `AADSTS65001: The user or administrator has not consented to use the application.`

→ 組織テナント側で管理者承認が必要。テナント管理者に「admin consent grant」を依頼する、または GCP のテストユーザー方式に近い限定公開で運用。

### `AADSTS70008: The refresh token has expired due to inactivity.`

→ Microsoft の refresh_token は 90 日間使われないと無効化される。再連携してもらう。
