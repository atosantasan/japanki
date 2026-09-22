# 基本設計書：システム全体構造図（アーキテクチャ）

> **バージョン履歴**
> | バージョン | 日付 | 変更内容 |
> |---|---|---|
> | v1.0 | 2026-09-19 | 現行 Next.js 16 + Supabase RPC + Stripe 都度課金の as-is |

---

## 1. アーキテクチャ概要

Japanki は **Next.js App Router** をフロント兼 BFF とし、学習データと権限の正は **Supabase PostgreSQL + RLS + SECURITY DEFINER RPC** に置く。ブラウザは匿名セッションで起動し、教材の閲覧・ハート・購入判定をサーバー側で確定する。

| レイヤー | 役割 | 技術 |
|---|---|---|
| **プレゼンテーション** | ロケール付き UI・ルーティング | Next.js App Router / React 19 / Tailwind v4 / next-intl |
| **クライアント状態** | 認証・所有パック・保留 Checkout | `AuthProvider`（Context） |
| **ドメインロジック** | シャッフル、正誤、ハート表示、アクセス判定 | `src/lib/quiz/*`, `src/lib/hearts/*`, `src/lib/phrases/*`, `src/lib/billing/*` |
| **BFF (Route Handlers)** | 有料フレーズ配信・Checkout・Webhook・Portal | `src/app/api/*` |
| **データ / 権限** | ユーザー・教材・セッション・購入 | Supabase PostgreSQL + RPC + RLS |
| **認証** | 匿名 / Google / Email | Supabase Auth |
| **決済** | 都度購入の確定 | Stripe Checkout + Webhook |
| **オフライン** | 静的アセットキャッシュ | Serwist Service Worker（開発時無効） |

クライアントから `quiz_attempts` / `quiz_session_questions` / `user_purchases` への直接 INSERT は RLS で不可能。変更は RPC または Admin（Webhook）のみ。

---

## 2. コンポーネント構成図

```mermaid
graph TD
    subgraph Client ["クライアント (ブラウザ / PWA)"]
        direction TB
        subgraph UI ["UI (next-intl App Router)"]
            P_Home["/{locale} ホーム"]
            P_Quiz["/{locale}/quiz/[packId]"]
            P_Account["/{locale}/account"]
            P_Success["/{locale}/success"]
            P_Legal["/{locale}/terms|privacy|legal"]
        end

        subgraph Logic ["クライアントロジック"]
            L_Auth["AuthProvider\n匿名起動 / Identity Linking\nownedPackIds / pendingCheckout"]
            L_Quiz["QuizPlay\ncreateQuizSession / consumeHeart"]
            L_Shuffle["shuffleChoiceOrder / prepareQuestion"]
            L_Audio["playPhraseAudio\nファイル or 生成トーン"]
            L_Hearts["recoverHearts\n表示用回復計算"]
        end

        subgraph SW ["Service Worker (Serwist)"]
            Cache["プリキャッシュ + defaultCache"]
            Bypass["Auth / Stripe / Supabase は NetworkOnly"]
        end
    end

    subgraph Server ["サーバー (Vercel / Next.js)"]
        Proxy["src/proxy.ts\nnext-intl + セッション Cookie 更新"]
        R_Phrases["GET /api/phrases\n認証 + 購入検証 + Zod"]
        R_Checkout["POST /api/checkout\n連携必須・二重購入防止"]
        R_Webhook["POST /api/stripe-webhook\n署名検証 → grantPurchase"]
        R_Portal["POST /api/billing/portal"]
        R_Export["GET /api/account/export"]
        R_Delete["POST /api/account/delete"]
        R_Callback["GET /auth/callback\ncode 交換 + sync_profile"]
    end

    subgraph External ["外部サービス"]
        SB_Auth["Supabase Auth"]
        SB_DB[("PostgreSQL\nprofiles / packs / phrases\nsessions / purchases")]
        SB_RPC["RPC\ncreate_quiz_session\nconsume_heart\nsubmit_answer\nsync_profile\nexport_my_data"]
        Stripe_API["Stripe Checkout / Portal"]
        Vercel["Vercel CDN / Serverless"]
    end

    P_Home --> L_Auth
    P_Quiz --> L_Quiz
    L_Quiz --> L_Shuffle
    L_Quiz --> L_Audio
    P_Home --> L_Hearts
    L_Quiz -->|"rpc"| SB_RPC
    L_Quiz -->|"fetch"| R_Phrases
    L_Auth -->|"Bearer + Cookie"| R_Checkout
    L_Auth --> SB_Auth
    P_Account --> R_Portal

    Proxy --> SB_Auth
    R_Phrases --> SB_DB
    R_Checkout --> Stripe_API
    R_Checkout --> SB_DB
    R_Webhook --> SB_DB
    R_Portal --> Stripe_API
    R_Callback --> SB_Auth
    R_Callback --> SB_RPC
    Stripe_API -->|"checkout.session.completed"| R_Webhook
    SB_RPC --> SB_DB

    style Client fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Server fill:#f3e5f5,stroke:#6a1b9a,stroke-width:2px
    style External fill:#fff3e0,stroke:#e65100,stroke-width:2px
    style SW fill:#fce4ec,stroke:#880e4f,stroke-width:1px
```

---

## 3. データフロー（権限の境界）

```mermaid
graph LR
    User(["ユーザー"])

    subgraph Browser ["ブラウザが直接触ってよいもの"]
        FreePhrases["無料 phrases SELECT"]
        OwnProfile["自身の profiles SELECT"]
        OwnSession["自身の quiz_sessions / questions SELECT"]
        OwnPurchases["自身の user_purchases SELECT"]
        RPC["authenticated RPC 実行"]
    end

    subgraph ServerOnly ["サーバー / Admin のみ"]
        PaidPhrases["有料 phrases 読み取り"]
        Grant["user_purchases INSERT"]
        Secret["SUPABASE_SECRET_KEY\nSTRIPE_SECRET_KEY"]
    end

    User --> Browser
    User -->|"GET /api/phrases"| PaidPhrases
    StripeWH["Stripe Webhook"] --> Grant

    style Browser fill:#e8f5e9,stroke:#388e3c
    style ServerOnly fill:#ffebee,stroke:#c62828
```

**原則**

1. 教材の正本は DB。UI は `messages/*.json`。
2. 5 問の集合は RPC が INSERT した `quiz_session_questions` が正。クライアントは並べ替えて表示するだけ。
3. 正誤判定の正は `submit_answer`。ハート減算の正は `create_quiz_session` の開始成功時1回。UI の `recoverHearts` は表示用。
4. 購入の正は Webhook → `grantPurchase`。Success URL は案内のみ。

---

## 4. デプロイ構成図

```mermaid
graph TD
    Dev["開発\nnpm run dev\nPWA 無効"] -->|"git push"| GitHub
    GitHub -->|"CI/CD"| Vercel

    subgraph Vercel ["Vercel"]
        Edge["Edge / CDN"]
        FN["Serverless\nApp Router + Route Handlers"]
        ProxyEdge["proxy.ts\nロケール + セッション"]
    end

    subgraph Supabase ["Supabase"]
        Auth["Auth: anonymous / Google / Email"]
        PG[("PostgreSQL + RLS + RPC")]
    end

    Stripe["Stripe 都度決済"]

    Vercel --> Auth
    Vercel --> PG
    Vercel --> Stripe
    Stripe -->|"Webhook"| FN

    style Vercel fill:#f3e5f5,stroke:#6a1b9a
    style Supabase fill:#e3f2fd,stroke:#1565c0
```

ビルドは `next build --webpack`（`package.json` の `build`）。`next.config.ts` は next-intl プラグインと Serwist を合成する。

---

## 5. レイヤー責務一覧

| レイヤー | ファイル | 責務 |
|---|---|---|
| **ページ** | `src/app/[locale]/page.tsx` | ホーム。Survival / Travel CTA と購入ボタン |
| **ページ** | `src/app/[locale]/quiz/[packId]/page.tsx` | クイズシェル。本体は `QuizPlay` |
| **ページ** | `src/app/[locale]/account/page.tsx` | 購入一覧・Portal・エクスポート・退会 |
| **ページ** | `src/app/[locale]/success/page.tsx` | 決済後案内。purchase-status をポーリング。権限付与はしない |
| **ページ** | `src/app/[locale]/{terms,privacy,legal}/page.tsx` | 規約・プライバシー・特商法 |
| **Proxy** | `src/proxy.ts` | next-intl ルーティング + `attachSupabaseSession` |
| **API** | `GET /api/phrases` | 認証・購入・Zod 済みフレーズ返却（`correct_choice_index` 非含） |
| **API** | `POST /api/checkout` | Identity 検証、二重購入防止、Checkout Session |
| **API** | `POST /api/stripe-webhook` | 署名検証と `grantPurchase` |
| **API** | `POST /api/billing/portal` | Customer Portal Session |
| **API** | `GET /api/account/export` | セッション RPC `export_my_data` + `getUser` 識別子の JSON |
| **API** | `POST /api/account/delete` | `deleteUser`。Stripe Customer 削除は best-effort |
| **Auth CB** | `GET /auth/callback` | OAuth/OTP の code 交換。`sync_profile` を試行 |
| **Context** | `src/components/auth/AuthProvider.tsx` | 匿名 boot、連携モーダル、所有パック、自動 Checkout |
| **クイズ UI** | `src/components/quiz/QuizPlay.tsx` | セッション開始時に1ハート、出題、音声 |
| **RPC クライアント** | `src/lib/quiz/rpc-client.ts` | `create_quiz_session` / `consume_heart` / `submit_answer` |
| **出題** | `src/lib/quiz/build-queue.ts` 等 | 5問検証、シャッフル、正誤 |
| **課金** | `src/lib/billing/*` | ガード、所有判定、Webhook、Portal |
| **i18n** | `src/i18n/*`, `src/lib/i18n/locales.ts` | 9 UI 言語、8 教材言語 |
| **Supabase** | `src/lib/supabase/{client,server,admin,config,session-proxy}.ts` | Anon / Cookie / Secret の使い分け |
| **PWA** | `src/sw.ts`, `src/app/manifest.ts` | SW と Web Manifest |
| **定数** | `src/lib/constants/app.ts` | アプリ名・連絡先・パック ID |

---

## 6. Supabase クライアントの使い分け

| モジュール | 鍵 | 用途 |
|---|---|---|
| `client.ts` | Anon + ブラウザ | Auth 操作、RPC、自身の SELECT |
| `server.ts` | Anon + cookies | Route Handler / Server の `getUser` |
| `session-proxy.ts` | Anon + cookies | 全ページリクエストでセッション更新 |
| `admin.ts` | `SUPABASE_SECRET_KEY` | 有料 phrases 読み取り、購入 INSERT、Checkout 時のパック参照 |

Admin は Route Handler 内でのみ使用する。Client Component から import しない。
