# サブスク化ロードマップ — 日程ピッカー Pro

「日程ピッカー Pro」を将来 SaaS (月額課金) として運用するための実装メモ。

## 現状 (Pro Beta)

- ✓ Pro 機能 (Outlook 連携、provider 別表示) はフルで Free 提供
- ✓ id_token から user email を抽出して `pro:user_email` に保存
- ✓ `pro:first_connected_at` で初回連携日時を記録 (上書きしない)
- ✓ SubscriptionBadge コンポーネントは「Free Pro Beta」を表示する状態
- ✓ API リクエストに `X-Subscriber-Email` を入れる足場 (バックエンドは現状無視)

→ これらは **将来の license enforcement を最小工数で追加するための地ならし**。

---

## Phase 1: 認証バックエンド (1-2 日)

### 目的
user email を起点に subscription state を管理できるようにする。

### 実装
- Vercel Postgres / Neon / Supabase を Pro project に接続
- スキーマ:
  ```sql
  CREATE TABLE subscribers (
    email TEXT PRIMARY KEY,
    stripe_customer_id TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'trial', -- 'trial' | 'active' | 'past_due' | 'canceled'
    trial_ends_at TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```
- `/api/license/check` エンドポイント:
  - 入力: `X-Subscriber-Email` ヘッダ
  - 出力: `{ status, trial_ends_at?, current_period_end? }`
  - 未登録 email は trial 14 日のレコードを作成して返す
- クライアントは起動時 + 24h ごとに license check → state 反映
- SubscriptionBadge を `status` に応じた表示に切替

---

## Phase 2: Stripe 連携 (2-3 日)

### 目的
trial 終了前 / 終了後にチェックアウトしてもらう。

### 実装
- Stripe Product/Price 作成 (例: 月額 1000円)
- `/api/billing/checkout` — Stripe Checkout Session を作成して URL を返す
- `/api/billing/webhook` — Stripe webhook を受けて subscribers テーブルを更新
  - `checkout.session.completed` → status="active"
  - `customer.subscription.updated` → status を反映
  - `customer.subscription.deleted` → status="canceled"
- クライアント UI:
  - SettingsPanel に「サブスクして使い続ける」ボタン (status="trial" のとき)
  - ボタン押下 → checkout session 生成 → window.open(url)

---

## Phase 3: Enforcement (0.5 日)

### 目的
trial 終了かつ active でない user に Pro 機能を制限する。

### 実装
- App.tsx で `pro:subscription_status` を確認:
  - `trial` / `active` → 全機能 OK
  - `past_due` → 警告だけ表示、機能は使える
  - `canceled` / `expired` → Outlook 連携を自動解除し、Google だけの「日程ピッカー (Free)」として動作
- API リクエストの `X-Subscriber-Email` をサーバ側で検証して、課金しないと使えないルート (例: `/api/auth/refresh` の microsoft 経路) をブロック

---

## Phase 4: 既存ユーザーへの配慮 (0.5 日)

Pro Beta 期間の user は first_connected_at が古い → 通知の上、trial を延長する措置:

- `first_connected_at` が 「サブスク導入日」より前なら、`trial_ends_at` を「サブスク導入日 + 30 日」に設定
- 初回 license check の時点で trial 起算するロジックも検討

---

## 認証フローのリマインダー

Pro 版では既に **Google または Microsoft の id_token から user email を取り出して保存** しているため、サブスク導入時の追加ログイン UI は不要。OAuth 完了 ≒ user 識別済の状態を維持できる。

```
OAuth (Google or Microsoft)
    │ id_token に email クレーム
    ▼
emailFromIdToken
    │
    ▼
secrets: pro:user_email
    │
    ▼ (将来)
/api/license/check ?email=<saved>
    │
    ▼
subscription state を反映
```

→ user は 「カレンダー連携」しか触らない。サブスク管理は SettingsPanel に集約。

---

## 想定コスト

- Stripe: 手数料 3.6% + ¥40/件
- Vercel: 無料枠で十分 (functions 100万呼出/月)
- DB: Neon Free tier (3GB / project) で当面足りる
- Microsoft Azure app: 無料
- GCP OAuth: 無料 (test users 100 名超えるなら有料の verification 申請)

→ 初期固定費はほぼゼロ、変動費は決済時の Stripe 手数料のみ。
