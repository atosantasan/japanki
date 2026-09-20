# サービスアーキテクチャ設計書：外部サービス連携

> **作成日**: 2026-09-19  
> **対象**: 現行実装（Next.js 16 PWA + Supabase + Stripe 都度課金）

---

## 1. 利用サービス一覧

| サービス | 種別 | 用途 | 課金モデル |
|---|---|---|---|
| **Vercel** | PaaS | ホスティング、Serverless、CDN | Hobby / Pro |
| **Supabase** | BaaS | Auth（匿名/Google/Email）、PostgreSQL、RPC、RLS | Free / Pro |
| **Stripe** | 決済 | Checkout 都度決済、Webhook、Customer Portal | 手数料 |
| **Google Identity** | IdP | Google OAuth（Supabase プロバイダー経由） | 無料枠 |

Gemini 等の生成 AI API は使わない。音声欠落時のフォールバックはブラウザ Web Audio。

---

## 2. 全体連携

```mermaid
graph TB
    subgraph User ["エンドユーザー"]
        Browser["ブラウザ / PWA"]
    end

    subgraph Vercel ["Vercel"]
        CDN["静的アセット"]
        SSR["App Router + Route Handlers"]
        SW["Serwist SW"]
        Proxy["proxy.ts"]
    end

    subgraph Supabase ["Supabase"]
        Auth["Auth"]
        PG[("PostgreSQL + RLS")]
        RPC["SECURITY DEFINER RPC"]
    end

    subgraph StripeCloud ["Stripe"]
        CO["Checkout"]
        Portal["Customer Portal"]
        WH["Webhook"]
    end

    Google["Google OAuth"]

    Browser --> CDN
    Browser --> SSR
    SW --> CDN
    Proxy --> Auth
    SSR --> Auth
    SSR --> PG
    SSR --> RPC
    Browser --> Auth
    Browser --> RPC
    Browser --> Google
    Google --> Auth
    SSR --> CO
    SSR --> Portal
    Browser --> CO
    WH -->|"POST /api/stripe-webhook"| SSR
    SSR -->|"grantPurchase"| PG

    style Vercel fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    style Supabase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style StripeCloud fill:#fff8e1,stroke:#f9a825,stroke-width:2px
```

---

## 3. サービス別詳細

### 3-1. Vercel

- Framework: Next.js。`build` は `next build --webpack`。
- Route Handlers が BFF。`/api/stripe-webhook` は raw body で署名検証するため `request.text()` を使う。
- 環境変数は Vercel プロジェクト設定。`NEXT_PUBLIC_*` のみクライアント埋め込み。

### 3-2. Supabase Auth

| 方式 | API | 用途 |
|---|---|---|
| Anonymous | `signInAnonymously` | ゲスト学習 |
| Google | `linkIdentity` / `signInWithOAuth` | 進捗保存・購入 |
| Email | `updateUser({email})` / `signInWithOtp` | 同上 |

コールバックは常に `{origin}/auth/callback`。`next` は Cookie `japanki_auth_next` または query。`safeNextPath` がオープンリダイレクトを防ぐ。

セッションは `@supabase/ssr` の Cookie。Proxy がページリクエストごとに `getUser()` して更新する。Checkout は Cookie に加え `Authorization: Bearer` を送り、OAuth 直後のラグで 401 しないようにする。

### 3-3. Stripe

**モードは `payment`（都度）。サブスクリプションではない。**

Checkout Session:

- `client_reference_id`: Supabase user id
- `metadata.supabase_user_id` / `metadata.pack_id`
- `success_url`: `/{locale}/success?pack=`
- `cancel_url`: `/{locale}`
- 価格: `stripe_price_id` があれば Price、なければ `price_data`（USD cents from `price_usd`）

Webhook は署名検証後に次を処理する。署名失敗は 400。metadata 欠落は 400。Success URL からの購入付与は行わない。

- `checkout.session.completed` / `checkout.session.async_payment_succeeded`: `payment_status === "paid"` のときのみ `grantPurchase`（`stripe_payment_intent_id` を保存）
- `payment_status !== "paid"`（非同期決済の unpaid）: 付与せず 200
- `charge.refunded`: `payment_intent` で `user_purchases` を削除しアクセス権を剥奪
- その他イベント: 200 で無視

Portal はメールで Customer を 1 件引き、`return_url` を `/{locale}/account` にする。

### 3-4. PWA（Serwist）

| 項目 | 値 |
|---|---|
| `swSrc` | `src/sw.ts` |
| `swDest` | `public/sw.js` |
| 開発 | `disable: NODE_ENV === "development"` |
| バイパス | `*.supabase.co`, `*.stripe.com`, Google OAuth, `/auth/` |

Manifest: standalone、背景 `#14110e`、テーマ `#e23d28`、アイコン `/icon-192.png` と `/icon-512.png`。

---

## 4. セキュリティ設計

### 4-1. シークレット配置

```mermaid
graph TD
    subgraph Server ["サーバーのみ"]
        SK["STRIPE_SECRET_KEY"]
        SSK["SUPABASE_SECRET_KEY"]
        WHS["STRIPE_WEBHOOK_SECRET"]
        CRON["CRON_SECRET"]
    end
    subgraph Client ["公開可"]
        SUL["NEXT_PUBLIC_SUPABASE_URL"]
        SAK["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
        APP["NEXT_PUBLIC_APP_URL"]
    end
```

`src/lib/security/client-secrets.test.ts` が Client 側への秘密鍵混入を検査する。

### 4-2. 認可

| 対象 | 制御 |
|---|---|
| テーブル変更 | RLS で INSERT/UPDATE/DELETE ポリシーなし + RPC `auth.uid()` |
| 有料 phrases | RLS 遮断 + `/api/phrases` で購入確認 |
| Checkout | 連携済み Identity 必須、所有済みは 400、付与は Webhook のみ |
| Webhook | `constructEvent` 署名 |
| 認証 next | 相対パスのみ |
| クイズ開始 | RPC `create_quiz_session` が同一 user 20回/時で `Rate limit exceeded`。BFF は 429 |
| 回答送信 | RPC `submit_answer` が `submit_answer_calls` を COUNT し同一 user 60回/時で `Rate limit exceeded`。BFF は 429 |
| 匿名掃除 | `GET/POST /api/internal/cleanup-anonymous-users` は `CRON_SECRET` Bearer のみ。同じ job が 1時間超の `submit_answer_calls` も削除 |

### 4-3. Identity 衝突

他ユーザーに既にある Google/Email へ link した場合、マージしない。ゲスト進捗は捨てて既存アカウントへログインする案内のみ（Human Gate 対象）。

---

## 5. 環境

| 環境 | URL | 特徴 |
|---|---|---|
| 開発 | `http://localhost:3000` | PWA 無効。Stripe は `stripe listen --forward-to localhost:3000/api/stripe-webhook` |
| 本番 | `NEXT_PUBLIC_APP_URL` | PWA 有効。Webhook 本番 endpoint |

---

## 6. 運用対策（Issue #17 対応済み）

匿名サインインと RPC 実行権限は残しつつ、無制限生成を次の閾値で抑える。値は `src/lib/constants/app.ts`。

| 対策 | 実装 | 閾値 |
|---|---|---|
| 匿名アカウント掃除 | Vercel Cron（毎日 03:00 UTC）が `GET /api/internal/cleanup-anonymous-users` を呼び、`auth.users` を削除。`profiles` / `quiz_sessions` / `quiz_session_questions` / `quiz_attempts` / `quiz_answers` / `user_purchases` / `submit_answer_calls` は ON DELETE CASCADE。同じ job が 1時間超の `submit_answer_calls` も DELETE | `is_anonymous = true` かつ `created_at` が `ANONYMOUS_RETENTION_DAYS`（30日）以上前、かつ `user_purchases` なし |
| セッション開始レート制限 | `create_quiz_session` が直近1時間の `quiz_sessions` を COUNT。専用カウンタテーブルは作らない。`idx_quiz_sessions_user_id_created_at` | `QUIZ_START_RATE_LIMIT_PER_HOUR` = 20。超過は `Rate limit exceeded` / HTTP 429 |
| 回答送信レート制限 | `submit_answer` が直近1時間の `submit_answer_calls` を COUNT（BFF 経由でも RPC 直叩きでも同じ）。`idx_submit_answer_calls_user_id_called_at`。Next.js in-memory limiter は撤去 | `SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR` = 60。超過は `Rate limit exceeded` / HTTP 429 |

### 本番適用（手動）

1. Supabase SQL Editor で `009_quiz_start_rate_limit.sql`、`010_submit_answer_rate_limit.sql`、`011_quiz_session_completion.sql` を適用する。`010` 未適用だと回答 60回/時は効かない。`011` 未適用だと `completed_at` と `quiz_answers` は書かれない。
2. Vercel 環境変数に `CRON_SECRET` を設定する（`NEXT_PUBLIC_` にしない）。Vercel Cron は `Authorization: Bearer ${CRON_SECRET}` を付ける。
3. `vercel.json` の既存 cron（毎日 03:00 UTC、`/api/internal/cleanup-anonymous-users`）が匿名アカウント掃除に加え、1時間より古い `submit_answer_calls` も削除する。Hobby は日次 cron まで。手動確認は `Authorization: Bearer $CRON_SECRET` 付きで GET または POST。
4. pg_cron は使わない（このリポジトリのテストと Vercel だけで完結させるため）。

`quiz_sessions.user_id` / `user_purchases.user_id` は当初から `profiles` ON DELETE CASCADE。Issue #25 の pack/phrase FK 変更対象外。`auth.users` 削除で孤児は残らない。

## 7. 将来考慮（未実装）

| 項目 | 現状 | 候補 |
|---|---|---|
| 音声アセット | URL のみ。ファイル未配置 | `public/audio/` または Storage |
| X シェア回復 | `last_x_shared_at` のみ | シェア成功でハート回復 |
| オフライン出題 | 不可 | 無料パックの Precache（有料は不可） |
| 追加パック | 2 パックのみ | `content_packs` 行追加 + シード Zod レビュー |
| サブスク | 都度 2.99 USD | 現状スコープ外 |
