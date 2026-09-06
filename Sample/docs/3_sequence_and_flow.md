# 基本設計書：画面遷移図 ＆ 処理シーケンス図

> **バージョン履歴**
> | バージョン | 日付 | 変更内容 |
> |---|---|---|
> | v1.0 | 2025年初版 | Expo (React Native) 版 |
> | v2.0 | 2026年6月 | Next.js PWA 版へ全面更新（認証・Stripe フロー追加） |
> | v2.1 | 2026年6月 | Supabase 在庫保存・楽観的 UI・制限値更新（25個/累計10回AI） |

---

## 1. 画面遷移図（UIフロー）

```mermaid
graph TD
    P_Login["/login ログイン画面"]
    P_Home["/ ホーム画面（PWA）\n在庫一覧タブ"]
    P_Shop["買い物リストタブ\n（ホーム画面内）"]
    P_Photo["写真登録タブ\n（ホーム画面内）"]
    P_Mypg["マイページタブ\n（ホーム画面内）"]
    P_Success["/success 決済完了画面"]
    P_AuthCB["/auth/callback\nOAuth/OTP コールバック"]

    subgraph Modal ["モーダル（ホーム画面内オーバーレイ）"]
        M_AddForm["新規登録フォーム\n（手動入力）"]
        M_EditForm["編集フォーム"]
        M_AIResult["AI解析結果確認フォーム"]
        M_PayWall["プレミアム案内\n（制限超過時）"]
        M_DupCheck["重複確認ダイアログ"]
    end

    Start([アプリ起動 / URL アクセス]) --> CheckSession{セッション確認\nMiddleware}
    CheckSession -->|"未ログイン\n（認証必須ページ）"| P_Login
    CheckSession -->|"セッション有効"| P_Home

    P_Login -->|"Magic Link 送信"| MailSent["メール送信完了\n（メールリンク待ち）"]
    P_Login -->|"Google OAuth"| GoogleOAuth["Google 認証ページ"]
    MailSent -->|"メール内リンクをクリック"| P_AuthCB
    GoogleOAuth -->|"認証完了"| P_AuthCB
    P_AuthCB -->|"セッション確立"| P_Home

    P_Home <--> P_Shop
    P_Home <--> P_Photo
    P_Home <--> P_Mypg

    P_Home -->|"「+追加」ボタン"| CheckLimit1{アイテム数チェック\n上限: 25個（無料）}
    CheckLimit1 -->|"上限超過"| M_PayWall
    CheckLimit1 -->|"枠内"| M_AddForm

    P_Photo -->|"写真選択・撮影後"| CheckLimit2{AI累計回数チェック\n上限: 10回（無料）}
    CheckLimit2 -->|"上限超過"| M_PayWall
    CheckLimit2 -->|"枠内"| AIAnalysis["Gemini API 解析中"]
    AIAnalysis -->|"解析完了"| M_AIResult

    M_AddForm -->|"保存"| DupCheck{重複チェック}
    M_AIResult -->|"確定"| DupCheck
    DupCheck -->|"重複あり"| M_DupCheck
    DupCheck -->|"重複なし"| P_Home
    M_DupCheck -->|"+1 または 新規"| P_Home

    P_Home -->|"カード編集ボタン"| M_EditForm
    M_EditForm -->|"保存"| P_Home
    M_EditForm -->|"削除確認→削除"| P_Home

    M_PayWall -->|"プレミアム購入"| StripeCheckout["Stripe Checkout\n（外部ページ）"]
    StripeCheckout -->|"決済完了"| P_Success
    P_Success --> P_Home

    P_Mypg -->|"サブスク管理"| StripePortal["Stripe Customer Portal\n（外部ページ）"]
    StripePortal --> P_Mypg

    P_Mypg -->|"ログアウト"| P_Login

    style P_Home fill:#b3e5fc
    style P_Shop fill:#b3e5fc
    style P_Login fill:#fff9c4
    style M_PayWall fill:#fff3e0
    style StripeCheckout fill:#e8f5e9
    style P_AuthCB fill:#f3e5f5
```

---

## 2. 認証フロー（Supabase Auth）

### 2-1. Magic Link 認証シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Browser as ブラウザ (Next.js)
    participant MW as Middleware\n(src/middleware.ts)
    participant Login as /login ページ
    participant Supabase as Supabase Auth
    participant Callback as /auth/callback

    User->>Browser: アプリにアクセス
    Browser->>MW: リクエスト
    MW->>Supabase: セッション確認 (updateSession)
    Supabase-->>MW: 未認証
    MW-->>Browser: /login にリダイレクト

    User->>Login: メールアドレスを入力して送信
    Login->>Supabase: signInWithOtp({ email })
    Supabase-->>Login: メール送信完了
    Login-->>User: 「メールを確認してください」表示

    User->>User: メール内の Magic Link をクリック
    User->>Callback: /auth/callback?token_hash=xxx&type=email

    Callback->>Supabase: verifyOtp({ token_hash, type })
    Supabase-->>Callback: セッション確立 (Cookie に保存)
    Callback-->>Browser: / にリダイレクト
    Browser-->>User: ホーム画面を表示
```

### 2-2. Google OAuth 認証シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant Login as /login ページ
    participant Supabase as Supabase Auth
    participant Google as Google OAuth
    participant Callback as /auth/callback

    User->>Login: 「Google でログイン」ボタンをタップ
    Login->>Supabase: signInWithOAuth({ provider: "google", redirectTo: "/auth/callback" })
    Supabase-->>Login: Google OAuth URL を返却
    Login-->>User: Google 認証ページへリダイレクト

    User->>Google: Google アカウントで認証
    Google-->>Callback: /auth/callback?code=xxx

    Callback->>Supabase: exchangeCodeForSession(code)
    Supabase-->>Callback: セッション確立 (Cookie に保存)
    Callback-->>User: / にリダイレクト（ホーム画面）
```

---

## 3. 写真撮影からAI解析・保存までのシーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as 写真タブ\n(page.tsx)
    participant LibAI as src/lib/ai.ts
    participant API_Analyze as /api/analyze\n(Route Handler)
    participant Gemini as Google Gemini API
    participant LibDB as src/lib/db/index.ts
    participant API as /api/app-status\nまたは localStorage
    participant LS as localStorage / Supabase

    User->>UI: 「写真を選択」または「撮影」
    UI->>LibDB: getAppStatus() で AI利用回数チェック
    LibDB->>API: ログイン時は API 経由で取得
    API-->>LibDB: ai_use_count_this_month（累計）
    LibDB-->>UI: 累計利用回数を返却

    alt AI利用回数 >= 10回 かつ 非プレミアム
        UI-->>User: プレミアム誘導モーダルを表示
    else 制限内
        User->>UI: 画像ファイルを選択
        UI->>LibAI: analyzeImage(file)
        LibAI->>LibAI: FileReader で base64 変換
        LibAI->>API_Analyze: POST { base64, mimeType }
        API_Analyze->>Gemini: generateContent(\n  { image: base64, prompt: 釣具情報抽出 }\n)
        
        alt Gemini API 正常応答
            Gemini-->>API_Analyze: JSON { brand, name, category_major, category_minor, color, size_gousu, weight }
            API_Analyze-->>LibAI: 解析結果JSON
        else API キー未設定 / エラー
            API_Analyze-->>LibAI: 501 または エラー
            LibAI->>LibAI: モック解析結果にフォールバック
        end
        
        LibAI-->>UI: 解析結果を返却
        UI-->>User: AI解析結果確認フォームを表示\n（フィールドに自動入力）

        User->>UI: 内容確認・修正後「保存」
        UI->>LibDB: findDuplicateExcluding() で重複チェック
        
        alt 重複アイテムあり
            UI-->>User: 重複確認ダイアログ表示
            User->>UI: 「既存在庫に+1」または「新規登録」を選択
        end
        
        UI->>LibDB: insertItem() または incrementQuantity()
        alt ログイン済み
            LibDB->>API: POST /api/items 等（Supabase 保存）
            API->>LS: items / item_specs / user_app_status
        else 未ログイン
            LibDB->>LS: fishing_gear_items, fishing_gear_specs に保存
        end
        LibDB->>LS: ai_use_count_this_month をインクリメント（月次リセットなし）
        UI-->>User: 在庫一覧タブへ切り替え
    end
```

---

## 4. 数量変更（タップ・長押し）シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as 在庫一覧\n(カードUI)
    participant Hook as useOptimisticQuantity
    participant LibDB as src/lib/db/index.ts
    participant API as /api/items/[id]/quantity
    participant Haptic as src/lib/haptic.ts
    participant Store as localStorage / Supabase RPC

    alt 数量を「+1」する場合 (シングルタップ)
        User->>UI: アイテムカードをシングルタップ
        UI->>Hook: applyDelta(+1)
        Hook->>UI: 画面を即時更新（楽観的 UI）
        Hook->>Haptic: triggerHaptic()
        Haptic-->>User: 触覚フィードバック
        Hook->>LibDB: adjustQuantity(itemId, +1) ※デバウンス後
        alt ログイン済み
            LibDB->>API: PATCH { delta: +1 }
            API->>Store: adjust_item_quantity RPC
        else 未ログイン
            LibDB->>Store: localStorage 直接更新
        end
        Store-->>UI: 同期完了

    else 数量を「-1」する場合 (長押し)
        User->>UI: アイテムカードを長押し（500ms）
        UI->>Hook: applyDelta(-1)
        Hook->>UI: 画面を即時更新（楽観的 UI）
        Hook->>Haptic: triggerHaptic()
        Haptic-->>User: 振動またはクリック音
        Hook->>LibDB: adjustQuantity(itemId, -1) ※デバウンス後
        LibDB->>Store: quantity = max(0, qty-1)\n0 なら is_shopping_list = 1
        Store-->>UI: 同期完了
        UI-->>User: 数字が減少\n（0個: 要補充スタイル＋買い物リストに追加）
    end
```

---

## 5. 手動登録・編集シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as ホーム画面\n(モーダル)
    participant LibDB as src/lib/db/index.ts
    participant Store as localStorage / Supabase

    alt 新規手動登録
        User->>UI: 「＋追加」ボタンをタップ
        UI->>LibDB: getItems() でアイテム数チェック
        Store-->>LibDB: アイテム配列を返却

        alt アイテム数 >= 25 かつ 非プレミアム
            UI-->>User: プレミアム誘導モーダルを表示
        else 登録可能
            UI-->>User: 新規登録フォームモーダルを表示
            User->>UI: フォーム入力して「保存」
            UI->>LibDB: findDuplicateExcluding(brand, name, specs)
            alt 重複あり
                UI-->>User: 重複確認ダイアログ
                User->>UI: 「+1」または「新規」を選択
            end
            UI->>LibDB: insertItem(formValues) または incrementQuantity()
            LibDB->>Store: items / item_specs に保存\n（ログイン時は API + Storage 画像）
            UI-->>User: 在庫一覧に新アイテムが追加
        end

    else 商品編集
        User->>UI: アイテムカードの編集ボタンをタップ
        UI->>LibDB: getItems() で対象アイテムを取得
        Store-->>LibDB: アイテムデータ
        LibDB-->>UI: アイテムデータをフォームに設定
        User->>UI: 内容を修正して「保存」
        UI->>LibDB: updateItem(id, formValues)
        LibDB->>Store: items と specs を更新
        UI-->>User: カードが更新された状態で表示

    else 商品削除
        User->>UI: 編集フォームで「削除」をタップ
        UI-->>User: 確認ダイアログ「本当に削除しますか？」
        User->>UI: 削除を確定
        UI->>LibDB: deleteItem(id)
        LibDB->>Store: items から削除\nitem_specs から関連行を削除
        UI-->>User: カードが一覧から消える
    end
```

---

## 8. 初回ログイン時の localStorage → Supabase 移行シーケンス

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as ホーム画面
    participant LibDB as src/lib/db/index.ts
    participant Migrate as src/lib/db/migrate.ts
    participant LS as localStorage
    participant API as /api/items 等
    participant Supabase as Supabase DB + Storage

    User->>UI: ログイン完了後にホーム画面を表示
    UI->>LibDB: bootstrapInventory()
    LibDB->>Migrate: migrateLocalToSupabaseIfNeeded()
    Migrate->>LS: localStorage にデータがあるか確認
    alt ローカルデータあり
        Migrate->>API: 各アイテムを POST /api/items
        API->>Supabase: items / item_specs / 画像を保存
        Migrate->>LS: 移行完了後にローカルデータをクリア
    end
    LibDB->>API: GET /api/inventory/bootstrap
    API->>Supabase: 在庫 + user_app_status を一括取得
    API-->>UI: クラウドデータを表示
```

---

## 6. Stripe 課金フロー（プレミアムプラン購入）

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as マイページ /\nプレミアム誘導モーダル
    participant API_CO as /api/checkout
    participant Stripe as Stripe API
    participant Success as /success ページ
    participant API_WH as /api/webhook
    participant Supabase as Supabase DB\n(profiles)

    User->>UI: 「プレミアムにアップグレード」タップ
    UI->>API_CO: POST { supabase_user_id }
    API_CO->>Stripe: stripe.checkout.sessions.create(\n  mode: "subscription",\n  price_id: STRIPE_PRICE_ID\n)
    Stripe-->>API_CO: Checkout Session URL
    API_CO-->>UI: { url: "https://checkout.stripe.com/..." }
    UI-->>User: Stripe Checkout ページへリダイレクト

    User->>Stripe: クレジットカード情報入力・決済実行
    Stripe-->>Success: success_url (/success?session_id=xxx) へリダイレクト
    Success-->>User: 決済完了メッセージ表示

    Stripe->>API_WH: POST checkout.session.completed イベント
    API_WH->>API_WH: Stripe Webhook 署名検証
    API_WH->>Supabase: UPDATE profiles\nSET subscription_status = 'active',\n    stripe_customer_id = xxx,\n    stripe_subscription_id = xxx\nWHERE id = supabase_user_id
    Supabase-->>API_WH: 更新完了

    Note over User,Supabase: 次回 /api/profile 取得時に\nsubscription_status = "active" が反映され\nプレミアム機能が解放される
```

---

## 7. Stripe サブスクリプション管理（キャンセル・変更）

```mermaid
sequenceDiagram
    autonumber
    actor User as ユーザー
    participant UI as マイページ
    participant API_Portal as /api/portal
    participant Stripe as Stripe API
    participant API_WH as /api/webhook
    participant Supabase as Supabase DB

    User->>UI: 「サブスクリプション管理」ボタンをタップ
    UI->>API_Portal: POST （認証済みセッション）
    API_Portal->>Supabase: profiles から stripe_customer_id を取得
    API_Portal->>Stripe: stripe.billingPortal.sessions.create(\n  customer: stripe_customer_id\n)
    Stripe-->>API_Portal: Portal URL
    API_Portal-->>UI: { url: "https://billing.stripe.com/..." }
    UI-->>User: Stripe Customer Portal へリダイレクト

    User->>Stripe: プラン変更またはキャンセル操作
    Stripe->>API_WH: customer.subscription.updated / deleted イベント
    API_WH->>Supabase: UPDATE profiles\nSET subscription_status = 'inactive'
    Supabase-->>API_WH: 更新完了

    Note over User,Supabase: 次回 /api/profile 確認時に\n制限が復活する
```
