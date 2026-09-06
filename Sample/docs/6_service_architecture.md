# サービスアーキテクチャ設計書：外部サービス連携

> **作成日**: 2026年6月  
> **対象バージョン**: Next.js PWA 版 (v2.1)  
> **アプリバージョン**: 1.1.5

---

## 1. 利用サービス一覧

| サービス | 種別 | 用途 | 課金モデル |
|---|---|---|---|
| **Vercel** | PaaS (デプロイ) | アプリホスティング・Serverless Functions・CDN | Hobby / Pro プラン |
| **Supabase** | BaaS | 認証（Auth）・在庫DB（PostgreSQL）・画像Storage | Free / Pro プラン |
| **Stripe** | 決済SaaS | サブスクリプション課金・Webhook | 従量課金（手数料） |
| **Google Gemini API** | AI/ML API | 釣具パッケージ画像の AI 解析 | 従量課金（トークン） |

---

## 2. サービス全体連携アーキテクチャ

```mermaid
graph TB
    subgraph User ["エンドユーザー"]
        Browser["ブラウザ\n(iOS Safari / Android Chrome\n/ デスクトップ)"]
    end

    subgraph Vercel ["Vercel (CDN + Serverless)"]
        direction TB
        CDN["Edge Network\n静的アセット配信"]
        SSR["Serverless Functions\nAPI Routes / SSR"]
        SW["Service Worker\n(Workbox)\nオフラインキャッシュ"]
        LS[("localStorage\n未ログイン時の在庫")]
    end

    subgraph Supabase ["Supabase (BaaS)"]
        direction TB
        SB_Auth["Supabase Auth\nMagic Link / Google OAuth"]
        SB_DB[("PostgreSQL\nprofiles / items / item_specs")]
        SB_Storage["Storage\nitem-images バケット"]
    end

    subgraph Google ["Google Cloud"]
        Gemini["Gemini API\ngenerative language\ngemini-2.5-flash-lite"]
        GoogleAuth["Google OAuth 2.0\n認証プロバイダー"]
    end

    subgraph Stripe_Cloud ["Stripe"]
        direction TB
        Stripe_API["Stripe API\nサブスクリプション管理"]
        Stripe_Checkout["Stripe Checkout\n決済UI（外部ページ）"]
        Stripe_Portal["Customer Portal\nサブスク管理UI（外部ページ）"]
        Stripe_Webhook["Webhook\nイベント通知"]
    end

    Browser <-->|"HTTPS"| CDN
    Browser <-->|"API Calls"| SSR
    Browser <-->|"localStorage R/W"| LS
    SW -->|"キャッシュ戦略"| CDN

    SSR -->|"セッション更新\nユーザー認証"| SB_Auth
    SSR -->|"在庫 CRUD / profiles"| SB_DB
    SSR -->|"商品画像アップロード"| SB_Storage
    SSR -->|"画像解析リクエスト\n(base64 + prompt)"| Gemini
    SSR -->|"Checkout Session 作成\nPortal Session 作成"| Stripe_API

    Browser -->|"Google ログイン\nリダイレクト"| GoogleAuth
    GoogleAuth -->|"OAuth コールバック"| SB_Auth
    SB_Auth -->|"セッション Cookie"| Browser

    Browser -->|"決済ページへ\nリダイレクト"| Stripe_Checkout
    Browser -->|"Portal ページへ\nリダイレクト"| Stripe_Portal
    Stripe_Checkout -->|"決済完了\nリダイレクト"| Browser

    Stripe_Webhook -->|"課金イベント通知\n(HTTPS POST)"| SSR
    SSR -->|"subscription_status 更新\n(Service Role)"| SB_DB

    style Vercel fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    style Supabase fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Google fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Stripe_Cloud fill:#fff8e1,stroke:#f9a825,stroke-width:2px
    style User fill:#fce4ec,stroke:#880e4f,stroke-width:2px
```

---

## 3. サービス別詳細設計

### 3-1. Vercel（デプロイ・CDN）

**役割:** アプリケーション全体のホスティングと配信

```mermaid
graph LR
    subgraph Vercel
        Config["vercel.json\nframework: nextjs\nbuildCommand: npm run build"]
        Edge_CDN["Edge CDN\n静的ファイル\n(JS/CSS/画像/PWAアセット)"]
        Serverless["Serverless Functions\n(API Routes)"]
        Build["ビルドパイプライン\nnext build --webpack"]
    end

    GitHub -->|"git push → CI/CD"| Build
    Build --> Edge_CDN
    Build --> Serverless
```

**設定（`vercel.json`）:**

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "installCommand": "npm install"
}
```

**環境変数（Vercel プロジェクト設定で管理）:**
- `NEXT_PUBLIC_*`: ビルド時にクライアントバンドルに埋め込まれる
- その他: Serverless Functions 実行時のみ参照可能

---

### 3-2. Supabase（認証・データベース）

**役割:** ユーザー認証・在庫データ・課金ステータスの永続化

```mermaid
graph TB
    subgraph Supabase
        direction TB
        Auth_MagicLink["Magic Link\n(OTP via Email)"]
        Auth_Google["Google OAuth\n(Supabase OAuth プロバイダー)"]
        Auth_Core["Supabase Auth Core\nセッション管理 (Cookie)"]
        PG[("PostgreSQL\nprofiles / items / item_specs")]
        Storage["Storage\nitem-images"]
        RLS["Row Level Security\n自分のデータのみアクセス可"]
        Trigger["DB Trigger\n新規ユーザー → profiles 自動作成"]
    end

    App_Client["クライアント\n(@supabase/ssr)"] -->|"signInWithOtp()"| Auth_MagicLink
    App_Client -->|"signInWithOAuth()"| Auth_Google
    Auth_MagicLink --> Auth_Core
    Auth_Google --> Auth_Core
    Auth_Core -->|"セッション Cookie"| App_Client

    App_Server["サーバー\n(API Routes)"] -->|"Service Role Key"| PG
    App_Client -->|"Anon Key + RLS"| PG
    PG --> RLS
    Auth_Core -->|"新規登録"| Trigger
    Trigger --> PG
```

**Supabase クライアントの使い分け:**

| モジュール | ファイル | 用途 | 認証情報 |
|---|---|---|---|
| ブラウザ用クライアント | `src/lib/supabase/client.ts` | クライアントコンポーネントでの認証操作 | Anon Key |
| サーバー用クライアント | `src/lib/supabase/server.ts` | Server Components / Route Handlers | Anon Key + cookies |
| Middleware クライアント | `src/lib/supabase/middleware.ts` | セッション更新（全リクエスト） | Anon Key + cookies |
| Admin クライアント | `src/lib/supabase/admin.ts` | Webhook 経由の DB 直接更新 | Service Role Key |

**Supabase Auth フロー（Magic Link）:**

```
1. signInWithOtp({ email }) → Supabase がメール送信
2. ユーザーがリンクをクリック → /auth/callback?token_hash=xxx
3. verifyOtp({ token_hash, type: "email" }) → セッション確立
4. Cookie にセッショントークンを保存
5. Middleware が毎リクエストで updateSession() を実行
```

---

### 3-3. Stripe（サブスクリプション課金）

**役割:** プレミアムプランの月額課金管理

```mermaid
sequenceDiagram
    participant App as Next.js App\n(Server)
    participant Stripe as Stripe API
    participant Browser as ブラウザ
    participant Webhook as /api/webhook
    participant DB as Supabase DB

    Note over App,DB: 購入フロー

    App->>Stripe: checkout.sessions.create(\n  mode: "subscription",\n  price: STRIPE_PRICE_ID,\n  metadata: { supabase_user_id }\n)
    Stripe-->>App: session.url
    App-->>Browser: { url }
    Browser->>Stripe: Checkout ページ表示
    Browser->>Stripe: 決済情報入力・確定

    Stripe->>Webhook: checkout.session.completed イベント
    Webhook->>Webhook: constructEvent(body, sig, secret)
    Webhook->>DB: UPDATE profiles SET\n  subscription_status = 'active',\n  stripe_customer_id = 'cus_xxx',\n  stripe_subscription_id = 'sub_xxx'

    Note over App,DB: 解約・変更フロー

    App->>Stripe: billingPortal.sessions.create(\n  customer: stripe_customer_id\n)
    Stripe-->>App: portal.url
    Browser->>Stripe: Customer Portal 表示・操作

    Stripe->>Webhook: customer.subscription.deleted
    Webhook->>DB: UPDATE profiles SET\n  subscription_status = 'inactive'
```

**Stripe 設定値:**

| 設定 | 環境変数 | 説明 |
|---|---|---|
| 秘密鍵 | `STRIPE_SECRET_KEY` | サーバーサイド API 呼び出し用 |
| 公開鍵 | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | フロントエンド用（現時点では直接使用なし） |
| Webhook シークレット | `STRIPE_WEBHOOK_SECRET` | Webhook 署名検証用 |
| Price ID | `STRIPE_PRICE_ID` | サブスクリプションの料金プラン ID |

**Webhook イベント処理:**

| イベント | 処理内容 |
|---|---|
| `checkout.session.completed` | `subscription_status = 'active'`、`stripe_customer_id`・`stripe_subscription_id` を保存 |
| `customer.subscription.updated` | `subscription_status` をイベントの `status` で更新 |
| `customer.subscription.deleted` | `subscription_status = 'inactive'` に更新 |

---

### 3-4. Google Gemini API（AI画像解析）

**役割:** 釣具パッケージ写真からメタデータを自動抽出

```mermaid
graph LR
    Browser["ブラウザ\n写真選択"]
    -->|"File object"| AI_Client["src/lib/ai.ts\nbase64 変換"]
    -->|"POST base64 + mimeType"| API_Route["/api/analyze\n(Server)"]
    -->|"generateContent()\n画像 + プロンプト"| Gemini["Google Gemini API\ngemini-2.5-flash-lite"]
    -->|"JSON レスポンス"| API_Route
    -->|"解析結果"| Browser

    API_Route -->|"エラー時"| Fallback["モック解析結果\nにフォールバック"]
```

**Gemini API リクエスト構造:**

```
モデル: gemini-2.5-flash-lite（環境変数 GEMINI_MODEL で変更可）

エンドポイント:
  https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent

リクエスト:
  - inlineData: { mimeType, data: base64 }
  - text: 釣具情報抽出プロンプト（JSON形式で返却指示）

レスポンス JSON 構造:
  {
    "brand": "シマノ",
    "name": "サイレントアサシン 99F",
    "category_major": "LURE",
    "category_minor": "MINNOW",
    "color": "チャートバックパール",
    "size_gousu": null,
    "weight": "11g"
  }
```

**フォールバック動作:**
- `GEMINI_API_KEY` 未設定: `/api/analyze` が 501 を返す → クライアントがモックデータで代替
- API エラー（ネットワーク等）: エラーをキャッチしモックデータにフォールバック

---

## 4. セキュリティ設計

### 4-1. シークレット管理

```mermaid
graph TD
    subgraph Server ["サーバーサイド（公開不可）"]
        SK["STRIPE_SECRET_KEY"]
        SRK["SUPABASE_SERVICE_ROLE_KEY"]
        WHS["STRIPE_WEBHOOK_SECRET"]
        GAK["GEMINI_API_KEY"]
        PID["STRIPE_PRICE_ID"]
    end

    subgraph Client ["クライアントサイド（NEXT_PUBLIC_* / 公開OK）"]
        SPK["NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"]
        SUL["NEXT_PUBLIC_SUPABASE_URL"]
        SAK["NEXT_PUBLIC_SUPABASE_ANON_KEY"]
        APP_URL["NEXT_PUBLIC_APP_URL"]
    end
```

### 4-2. 認可・アクセス制御

| 対象 | 制御方式 | 詳細 |
|---|---|---|
| Supabase profiles / items 等 | Row Level Security (RLS) | `auth.uid() = user_id`（または `id`）のみ CRUD 可 |
| 在庫 API Routes | Cookie セッション確認 | 未認証の場合 401 を返す |
| Storage item-images | フォルダ単位の RLS | `auth.uid()` とパスの先頭フォルダが一致する場合のみ書き込み可 |
| Stripe Webhook | 署名検証 | `stripe.webhooks.constructEvent()` で正当性確認 |
| Supabase 管理操作 | Service Role Key | Webhook 経由のみ使用（クライアント非公開） |

### 4-3. CORS・オリジン制御

```typescript
// next.config.ts
allowedDevOrigins: ["192.168.0.250", "localhost"]
// → LAN 内の実機テスト（スマートフォン）からのアクセスを許可
```

---

## 5. 環境構成

| 環境 | URL | 特徴 |
|---|---|---|
| **開発環境** | `http://localhost:3000` または `http://192.168.0.250:3000` | `next dev --webpack`, PWA 無効, DevOriginNormalizer が動作 |
| **本番環境** | `https://<your-app>.vercel.app` | `next build`, PWA 有効, Stripe 本番 |

### 開発時の特記事項

1. **`DevOriginNormalizer` コンポーネント**: 開発時に `0.0.0.0` で起動したアプリにアクセスした場合、`localhost` に自動リダイレクトする（Supabase OAuth のコールバック URL がホスト名に依存するため）
2. **PWA は開発時無効**: `@ducanh2912/next-pwa` は `NODE_ENV=development` 時に自動で無効化される
3. **Stripe Webhook のローカルテスト**: `stripe listen --forward-to localhost:3000/api/webhook` で Stripe CLI を使用

---

## 6. 拡張性と将来考慮事項

| 項目 | 現状 | 将来の拡張候補 |
|---|---|---|
| 釣具データの同期 | ✅ 実装済み（ログイン時 Supabase、未ログイン時 localStorage） | オフライン時の書き込みキュー・競合解決 |
| プッシュ通知 | 未実装 | Web Push API + Service Worker で在庫切れ通知 |
| バーコードスキャン | `jan_code` フィールドは用意済み | カメラ API + バーコードライブラリで JAN コード読み取り |
| 釣果ログ | 未実装 | items に紐づく `catch_logs` テーブルの追加 |
| 多言語対応 | 日本語のみ | `next-intl` 等での i18n 対応 |
| Analytics | 未実装 | Vercel Analytics または Google Analytics 連携 |
