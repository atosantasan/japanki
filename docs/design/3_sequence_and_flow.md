# 基本設計書：画面遷移図 ＆ 処理シーケンス図

> **バージョン履歴**
> | バージョン | 日付 | 変更内容 |
> |---|---|---|
> | v1.0 | 2026-09-19 | 現行ルート・認証・クイズ・Stripe フロー |

---

## 1. 画面遷移図（UIフロー）

ロケールプレフィックス `/{locale}` は省略して書く（例: `/en/quiz/survival`）。

```mermaid
graph TD
    Start([アプリ起動]) --> Home["/ ホーム"]

    Home -->|"Start learning"| QuizFree["/quiz/survival"]
    Home -->|"Travel pack"| QuizPaid["/quiz/travel"]
    Home -->|"未所有: Buy travel pack"| CheckoutGuard{Google/Email 連携済み?}
    Home -->|"所有済み: Start learning"| QuizPaid

    CheckoutGuard -->|"いいえ"| LinkModal["Identity Linking モーダル"]
    CheckoutGuard -->|"はい"| StripeCO["Stripe Checkout 外部"]
    LinkModal -->|"Google / Email"| AuthCB["/auth/callback"]
    AuthCB --> Home
    Home -->|"pendingCheckout あり"| StripeCO

    StripeCO -->|"決済完了"| Success["/success"]
    Success -->|"Open travel pack"| QuizPaid
    Success -->|"View purchases"| Account["/account"]

    QuizFree --> Play["QuizPlay 5問"]
    QuizPaid --> PaidOK{購入済み?}
    PaidOK -->|"いいえ"| Locked["Purchase required"]
    PaidOK -->|"はい"| Play
    Play --> Complete["1-minute complete!"]
    Complete --> Home

    Home --> Account
    Home --> Terms["/terms"]
    Home --> Privacy["/privacy"]
    Home --> Legal["/legal"]

    Account -->|"Manage billing"| Portal["Stripe Customer Portal"]
    Portal --> Account

    style Home fill:#b3e5fc
    style Play fill:#c8e6c9
    style LinkModal fill:#fff9c4
    style StripeCO fill:#e8f5e9
    style Locked fill:#ffcdd2
```

### 主要ルート

| パス | 役割 |
|---|---|
| `/{locale}` | ホーム。無料開始・有料導線・購入/所有 CTA |
| `/{locale}/quiz/[packId]` | クイズ。`packId` は `survival` / `travel` |
| `/{locale}/success` | 決済完了案内。権限は付与しない |
| `/{locale}/account` | 所有パックと Portal |
| `/{locale}/terms` `/privacy` `/legal` | 法務 |
| `/auth/callback` | ロケール外。OAuth/OTP コールバック |
| `/api/*` | BFF。Proxy matcher から除外 |

---

## 2. 匿名起動と Identity Linking

### 2-1. 起動時匿名セッション

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Auth as AuthProvider
    participant SB as Supabase Auth
    participant RPC as sync_profile

    User->>Auth: 初回表示
    Auth->>SB: getSession / getUser
    alt セッションなし
        Auth->>SB: signInAnonymously()
    end
    Auth->>RPC: syncProfileSafely(locale)
    RPC-->>Auth: hearts / is_anonymous / preferred_language
    Auth->>SB: user_purchases SELECT
    SB-->>Auth: ownedPackIds
    Auth-->>User: Guest 表示 + ハート
```

### 2-2. Google 連携（ゲスト継続 vs 既存アカウント）

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Auth as AuthProvider
    participant SB as Supabase Auth
    participant Google as Google OAuth
    participant CB as /auth/callback

    User->>Auth: Continue with Google
    Auth->>Auth: persistAuthNextPath (cookie)
    alt ゲスト継続 link
        Auth->>SB: linkIdentity(google, skipBrowserRedirect)
    else 既存アカウント
        Auth->>SB: signOut()
        Auth->>SB: signInWithOAuth(google)
    end
    SB-->>Auth: OAuth URL
    Auth-->>User: Google へ遷移
    User->>Google: 同意
    Google->>CB: /auth/callback?code=
    CB->>SB: exchangeCodeForSession(code)
    CB->>SB: rpc sync_profile
    CB-->>User: next パスへリダイレクト（オープンリダイレクト防止済み）
```

Identity 衝突時は `mapAuthError` が `identity_collision` を返し、自動マージせず既存ログインを案内する。

### 2-3. Email

- **ゲスト継続**: `updateUser({ email })` → 確認メール。
- **既存ログイン**: 匿名を `signOut` した上で `signInWithOtp`。

---

## 3. クイズ開始〜5問完了

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as QuizPlay
    participant RPC as create_quiz_session
    participant API as GET /api/phrases
    participant DB as Supabase

    User->>UI: /quiz/{packId}
    UI->>RPC: pack_id_param
    RPC->>RPC: auth.uid() 必須
    alt 有料かつ未購入
        RPC-->>UI: Purchased pack permission required
        UI-->>User: paidLocked
    else フレーズ 5 未満
        RPC-->>UI: Not enough phrases...
        UI-->>User: startError
    else OK
        RPC->>DB: quiz_sessions + ランダム5問 INSERT
        RPC-->>UI: session_id
        UI->>API: pack_id
        API->>API: getUser / getPack / hasPurchase / Zod
        API-->>UI: phrases[]
        UI->>DB: quiz_session_questions SELECT
        UI->>UI: buildQuizQueue → prepareQuestion(shuffle)
        loop 5問
            UI-->>User: 日本語 + ローマ字 + 音声 + 3択
            User->>UI: 選択
            UI->>RPC: submit_answer(session, phrase, selected_text, locale)
            RPC-->>UI: is_correct, remaining_hearts, correct_choice_text
            alt 正解
                UI-->>User: Correct
            else 誤答
                UI-->>User: Incorrect（ハートは RPC 内 consume_heart）
            end
            User->>UI: Next
        end
        UI-->>User: 1-minute complete!
    end
```

`buildQuizQueue` は assigned がちょうど 5 件のユニーク ID であること、各フレーズが同一 `packId` に属することを検証する。

---

## 4. ハート減算（アトミック）

```mermaid
sequenceDiagram
    autonumber
    participant UI as QuizPlay
    participant RPC as consume_heart
    participant DB as profiles / quiz_attempts

    UI->>RPC: session_id, phrase_id
    RPC->>RPC: auth.uid()
    RPC->>DB: セッション所有者 = uid か
    RPC->>DB: phrase が session に割当済みか
    RPC->>DB: INSERT quiz_attempts ON CONFLICT DO NOTHING RETURNING id
    alt RETURNING なし（2回目以降）
        RPC-->>UI: 現状の hearts（減算なし）
    else 初回誤答
        RPC->>DB: profiles FOR UPDATE
        RPC->>RPC: 30分回復を加算（上限5）
        alt 回復後 hearts > 0
            RPC->>DB: hearts - 1
        end
        RPC-->>UI: remaining_hearts, updated_at
    end
```

クライアントの `recoverHearts` はヘッダー表示用であり、減算の正本ではない。

---

## 5. 有料フレーズ取得

```mermaid
sequenceDiagram
    autonumber
    participant UI as QuizPlay
    participant API as /api/phrases
    participant UserSB as Cookie セッション
    participant Admin as SUPABASE_SECRET_KEY

    UI->>API: GET ?pack_id=travel
    API->>UserSB: auth.getUser()
    alt 未ログイン
        API-->>UI: 401
    else
        API->>Admin: content_packs
        alt パックなし
            API-->>UI: 404
        else 有料かつ未購入
            API->>Admin: user_purchases
            API-->>UI: 403
        else 許可
            API->>Admin: phrases SELECT + Zod
            API-->>UI: 200 { phrases }
        end
    end
```

無料パックでも API は認証を要求する。クライアント RLS でも無料 phrases は読めるが、クイズ UI は常に API 経由で揃える。

---

## 6. Stripe 都度購入

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as PurchaseButton / AuthProvider
    participant API as POST /api/checkout
    participant Stripe as Stripe
    participant WH as /api/stripe-webhook
    participant Admin as user_purchases

    User->>UI: Buy travel pack
    UI->>API: { packId, locale } + Bearer
    API->>API: getUser / hasLinkedIdentity
    alt 匿名
        API-->>UI: 403 identity_linking_required
        UI-->>User: 連携モーダル
    else 所有済み
        API-->>UI: 400 既に購入済みのパックです
    else 無料パック指定
        API-->>UI: 400 Pack is free
    else OK
        API->>Stripe: checkout.sessions.create(mode=payment)
        Stripe-->>API: url
        API-->>UI: { url }
        UI-->>User: Checkout へ
        User->>Stripe: 支払い
        Stripe-->>User: /{locale}/success（案内のみ。未着なら未購入のまま）
        Stripe->>WH: checkout.session.completed
        WH->>WH: constructEvent 署名検証
        WH->>Admin: grantPurchase INSERT
        alt unique 衝突
            Admin-->>WH: duplicate（冪等成功）
        end
        Note over User,Admin: Success ページは INSERT しない
    end
```

連携後の自動 Checkout は `pendingCheckoutPackId`（URL `?checkout=` または `japanki_pending_checkout_pack`）を `AuthProvider` が見つけ、非匿名かつ未所有なら `triggerCheckout` する。

---

## 7. Customer Portal

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Acc as AccountPanel
    participant API as POST /api/billing/portal
    participant Stripe as Stripe

    User->>Acc: Manage billing
    Acc->>API: { locale }
    API->>API: 認証 + Identity ガード
    API->>Stripe: customers.list(email)
    alt 顧客なし
        API-->>Acc: 404
    else
        API->>Stripe: billingPortal.sessions.create
        Stripe-->>User: Portal
        User->>Acc: return_url /account
    end
```
