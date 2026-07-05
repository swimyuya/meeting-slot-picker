# リリース手順 (メンテナ向け)

このアプリは **GitHub Releases + Tauri 自動アップデータ**で配布する。tag push で CI が自動ビルド・署名・公開する設計。

## 初回セットアップ（1回だけ）

### 1. 更新署名鍵の生成

```bash
mkdir -p ~/.tauri
npm run tauri -- signer generate -w ~/.tauri/meeting-slot-picker.key --ci -p ""
cat ~/.tauri/meeting-slot-picker.key.pub   # 公開鍵 (base64)
```

公開鍵は `src-tauri/tauri.conf.json` の `plugins.updater.pubkey` に既に設定済み。秘密鍵 (`~/.tauri/meeting-slot-picker.key`) は次の GitHub Secrets で参照する。

### 2. GitHub Secrets 設定

リポジトリ → Settings → Secrets and variables → Actions → New secret:

| 名前 | 値 |
|------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | `cat ~/.tauri/meeting-slot-picker.key` の中身全体 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 空 (鍵作成時にパスワード無しで生成した場合) |
| `VITE_GOOGLE_CLIENT_ID` | GCP の OAuth Desktop クライアント ID |
| `VITE_GOOGLE_CLIENT_SECRET` | 同シークレット (Desktop クライアントは Google 上「非機密」扱い) |

### 3. GCP OAuth クライアント

- GCP Console > APIs & Services > Credentials で **Desktop app** タイプの OAuth クライアントを作成（配布専用に新規推奨、既存と分離）
- OAuth 同意画面 → 「対象」 → テストユーザーに配布対象者の Google メールを追加（上限 100 名）
- 公開ステータスは「テスト中」維持

### 4. tauri.conf.json の endpoints URL を確認

`plugins.updater.endpoints` のリポジトリ URL が自分の GitHub リポジトリと一致しているか確認:

```
https://github.com/<owner>/meeting-slot-picker/releases/latest/download/pro-latest.json
```

## リリース手順 (毎回)

### 1. 事前テスト

```bash
npm test                                                # フロントエンド単体・結合
cargo test --manifest-path src-tauri/Cargo.toml         # Rust ユニット
npm run build                                           # 型チェック + Vite ビルド
npm run e2e                                             # Playwright E2E
npm run tauri:build -- --target universal-apple-darwin  # 実機ビルド検証 (任意)
```

### 2. バージョン bump

```bash
npm version patch --no-git-tag-version   # or minor / major  → package.json が更新される
node scripts/sync-version.mjs   # Cargo.toml と tauri.conf.json を同期
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to X.Y.Z"
```

### 3. tag を push

CI は `pro-vX.Y.Z` 形式の tag でのみ発火する（無印の `vX.Y.Z` では動かない）:

```bash
git tag pro-vX.Y.Z
git push --follow-tags
```

→ GitHub Actions が自動で:
- macOS ランナーで Universal Binary をビルド
- `.dmg` + `.app.tar.gz` + `.sig` + `pro-latest.json` を生成
- GitHub Release を作成しアーティファクトを添付

### 4. 既存ユーザーへの反映

既存ユーザーは次回起動時、アプリ起動 ~3 秒後にアップデート確認 → 「新しい版があります」バー表示 → 「今すぐ更新」で適用・再起動。

## トラブルシューティング

### 鍵をなくした / パスワードを忘れた

- 新しい鍵ペアを生成し、`tauri.conf.json` の `pubkey` を差し替え、`TAURI_SIGNING_PRIVATE_KEY` Secret を入れ替える
- ⚠️ 既存ユーザーは自動アップデートできなくなる（pubkey が変わると古い版が新版を信頼できないため）→ 全員が `.dmg` を手動再 DL する必要あり

### GCP OAuth テストユーザー枠が埋まった (90人超え)

- Google 検証申請 (公開ステータスを "本番環境" に切替) を検討。calendar.readonly は機密スコープなので Google レビューが入る（数週間）

### 配布する secret が流出した懸念

- GCP で OAuth クライアント secret を再発行 → `VITE_GOOGLE_CLIENT_SECRET` Secret を更新 → 次のリリースに反映
- Desktop client_secret は Google 仕様上「非機密」だが、漏洩は健全でないので速やかに更新
