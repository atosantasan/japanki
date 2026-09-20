# 基本設計書：データストア詳細スキーマ設計

> **バージョン履歴**
> | バージョン | 日付 | 変更内容 |
> |---|---|---|
> | v1.0 | 2026-09-19 | `supabase/migrations/001`〜`003` の as-is |
> | v1.1 | 2026-09-20 | Issue #25: パック/フレーズ FK を ON DELETE RESTRICT に明示 (`005`) |
> | v1.2 | 2026-09-20 | Issue #24 / #37: `price_usd` を numeric(10,2) に拡張し `is_active` を追加 (`006`) |
| v1.3 | 2026-09-20 | Issue #42: `is_active=false` を一時非表示に変更（既存購入者は継続プレイ可、`008`） |

マイグレーション適用順:

1. `001_init.sql` — テーブル、インデックス、RPC（`create_quiz_session`, `consume_heart`）、RLS
2. `002_sync_profile.sql` — `sync_profile`（Identity 連携後のプロファイル同期）
3. `003_seed_packs.sql` — Survival / Travel と各 5 フレーズ
4. `004_submit_answer_and_billing_guards.sql` — `submit_answer` RPC と購入履歴の保護
5. `005_fk_on_delete_policy.sql` — パック/フレーズ参照 FK を ON DELETE RESTRICT に付け替え
6. `006_content_packs_price_and_active.sql` — `price_usd` numeric(10,2) と論理削除 `is_active`
7. `007_diversify_seed_correct_index.sql` — シードの `correct_choice_index` を 0/1/2 に分散（Issue #16）
8. `008_inactive_pack_purchased_play.sql` — `is_active=false` でも購入済みは `create_quiz_session` 可（Issue #42）

---

## 1. データストア概要

| ストア | 技術 | 用途 |
|---|---|---|
| **Supabase PostgreSQL** | クラウド DB | ユーザー、教材、クイズセッション、購入。正本 |
| **ブラウザ Cookie** | Supabase SSR | Auth セッション |
| **sessionStorage / localStorage** | `japanki_pending_checkout_pack` | 連携前の購入パック ID 一時保持 |
| **Cookie** | `japanki_auth_next` | OAuth 復帰先パス（10分、相対パスのみ） |

学習進捗のローカル DB は持たない。未設定環境では匿名サインインをスキップし、クイズは `notConfigured` を出す。

---

## 2. ER図

```mermaid
erDiagram
    auth_users ||--o| profiles : "1対1"
    content_packs ||--o{ phrases : "1対多"
    content_packs ||--o{ quiz_sessions : "1対多"
    content_packs ||--o{ user_purchases : "1対多"
    profiles ||--o{ quiz_sessions : "1対多"
    profiles ||--o{ user_purchases : "1対多"
    quiz_sessions ||--o{ quiz_session_questions : "ちょうど5"
    quiz_sessions ||--o{ quiz_attempts : "誤答1回目"
    phrases ||--o{ quiz_session_questions : "割当"
    phrases ||--o{ quiz_attempts : "誤答"

    profiles {
        uuid id PK
        boolean is_anonymous
        text preferred_language
        integer hearts
        timestamptz last_heart_updated_at
        timestamptz last_x_shared_at "未使用"
        timestamptz created_at
    }

    content_packs {
        text id PK
        jsonb title
        jsonb description
        boolean is_free
        boolean is_active "DEFAULT true"
        numeric price_usd "numeric(10,2)"
        text stripe_price_id
        timestamptz created_at
    }

    phrases {
        uuid id PK
        text pack_id FK "ON DELETE RESTRICT"
        text romaji
        text japanese
        text audio_url
        jsonb translations
        jsonb choices_by_lang
        integer correct_choice_index
        integer sort_order
    }

    quiz_sessions {
        uuid id PK
        uuid user_id FK "ON DELETE CASCADE"
        text pack_id FK "ON DELETE RESTRICT"
        timestamptz completed_at "未使用"
        timestamptz created_at
    }

    quiz_session_questions {
        uuid id PK
        uuid session_id FK "ON DELETE CASCADE"
        uuid phrase_id FK "ON DELETE RESTRICT"
        integer position "1..5"
    }

    quiz_attempts {
        uuid id PK
        uuid session_id FK "ON DELETE CASCADE"
        uuid phrase_id FK "ON DELETE RESTRICT"
        timestamptz first_incorrect_at
    }

    user_purchases {
        uuid id PK
        uuid user_id FK "ON DELETE CASCADE"
        text pack_id FK "ON DELETE RESTRICT"
        timestamptz created_at
    }
```

---

## 3. テーブル定義

### 3-1. `profiles`

`auth.users` INSERT 時に `handle_new_user` が 1 行作成する（ハート 5、`is_anonymous` は provider が anonymous なら true）。

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| `id` | uuid | PK, FK → auth.users ON DELETE CASCADE | Auth ユーザーと同一 |
| `is_anonymous` | boolean | default true | Identity 未連携 |
| `preferred_language` | text | default `en` | UI ロケール |
| `hearts` | integer | 0〜5 | ハート残数 |
| `last_heart_updated_at` | timestamptz | | 減算・回復計算の基準時刻 |
| `last_x_shared_at` | timestamptz | nullable | 将来の X シェア回復用。アプリ未使用 |
| `created_at` | timestamptz | | 作成日時 |

クライアントは SELECT のみ（自分の行）。更新は `sync_profile` / `consume_heart`。

### 3-2. `content_packs`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | text PK | `survival` / `travel` |
| `title` / `description` | jsonb | 8 言語キー |
| `is_free` | boolean | 無料判定 |
| `is_active` | boolean NOT NULL DEFAULT true | 一時非表示フラグ（既存購入者は継続プレイ可）。Issue #37 / #42。false でカタログと新規購入から除外 |
| `price_usd` | numeric(10,2) | Checkout の `price_data` に使用（stripe_price_id が無い場合）。Issue #24 で (4,2) から拡張 |
| `stripe_price_id` | text | 設定時は Stripe Price を優先 |

SELECT は全員可（購入履歴のタイトル表示のため非アクティブ行も読める）。パックの物理削除は子テーブル FK が RESTRICT のため拒否される。`is_active = false` は一時非表示（コンテンツ更新中など）。無料パックと未購入ユーザーは not found。有料の既存購入者はプレイ継続可（Issue #42 / `008`）。新規 Checkout は非表示中も 404 のまま。

### 3-3. `phrases`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | uuid | シードは固定 UUID |
| `pack_id` | text FK → content_packs ON DELETE RESTRICT | 所属パック。パック物理削除は拒否 |
| `romaji` / `japanese` | text | 出題表示 |
| `audio_url` | text | 例: `/audio/arigatou.mp3` |
| `translations` | jsonb | 8 言語の訳 |
| `choices_by_lang` | jsonb | 8 言語 × 3 択 |
| `correct_choice_index` | integer | 0〜2。シードはパック内で 0/1/2 に分散（`007`、Issue #16） |
| `sort_order` | integer | API 取得時の並び。セッション内順は `position` |

クライアント SELECT は **無料パックのみ**。有料は `/api/phrases` + Admin。

Zod（`PhraseRecordSchema`）は教材検証用に 8 言語キーと 3 択タプル、UUID、`correct_choice_index` 0〜2 を検証する。公開 API は `PublicPhraseRecordSchema` により `correct_choice_index` を出力しない。`ja` キーは教材に存在しない。

### 3-4. `quiz_sessions`

ユーザーとパックに紐づく 1 プレイ。`completed_at` は現行 UI から更新されない。`user_id` は profiles ON DELETE CASCADE、`pack_id` は content_packs ON DELETE RESTRICT。

### 3-5. `quiz_session_questions`

| 制約 | 意味 |
|---|---|
| `position` BETWEEN 1 AND 5 | スロット |
| UNIQUE (`session_id`, `position`) | 同一位置に 2 問置かない |
| UNIQUE (`session_id`, `phrase_id`) | 同一セッションで同一 phrase を重複割当しない |

クライアント INSERT 不可。SELECT は自分のセッションのみ（QuizPlay が順序取得に使用）。`session_id` は quiz_sessions ON DELETE CASCADE、`phrase_id` は phrases ON DELETE RESTRICT（出題済みフレーズの物理削除を拒否し履歴を保持）。

### 3-6. `quiz_attempts`

同一 (`session_id`, `phrase_id`) は 1 行。初回誤答時刻のみ保持。SELECT ポリシーなし（クライアントは読めない）。INSERT は `consume_heart` / `submit_answer` のみ。`session_id` は quiz_sessions ON DELETE CASCADE、`phrase_id` は phrases ON DELETE RESTRICT（ハート減算履歴を保持するためフレーズ物理削除を拒否）。

| 制約 | 意味 |
|---|---|
| UNIQUE (`session_id`, `phrase_id`) `quiz_attempts_session_id_phrase_id_key` | AC-QUIZ-05。`ON CONFLICT (session_id, phrase_id) DO NOTHING` の対象 |

### 3-7. `user_purchases`

UNIQUE (`user_id`, `pack_id`) が Webhook 再送の冪等キー。SELECT は本人のみ。INSERT は Admin の `grantPurchase` のみ（エラーコード `23505` は duplicate として成功扱い）。`stripe_payment_intent_id` で返金時の行特定を行う。`user_id` は profiles ON DELETE CASCADE、`pack_id` は content_packs ON DELETE RESTRICT（購入履歴をパック削除から守る）。

### 3-8. FK ON DELETE 方針（Issue #25）

`001_init.sql` ではパック/フレーズ参照が `ON DELETE CASCADE` だった。`005_fk_on_delete_policy.sql` で以下を `RESTRICT` に付け替える。パックのカタログ非表示は物理 DELETE せず、`content_packs.is_active`（Issue #37 / #42）で一時非表示にする。既存購入者のプレイは `008` で継続できる。

| FK | 参照先 | ON DELETE | 理由 |
|---|---|---|---|
| `phrases.pack_id` | `content_packs.id` | RESTRICT | パック誤削除で教材が一括消失する事故を防ぐ |
| `quiz_sessions.pack_id` | `content_packs.id` | RESTRICT | プレイ履歴をパック削除から守る |
| `user_purchases.pack_id` | `content_packs.id` | RESTRICT | 購入履歴をパック削除から守る |
| `quiz_session_questions.phrase_id` | `phrases.id` | RESTRICT | 出題割当履歴を保持する |
| `quiz_attempts.phrase_id` | `phrases.id` | RESTRICT | ハート減算履歴を保持する |
| `profiles.id` | `auth.users.id` | CASCADE | 既存。Auth 削除に追随 |
| `*.user_id` / `*.session_id` | profiles / quiz_sessions | CASCADE | ユーザーまたはセッション削除時の子行掃除 |

---

## 4. インデックス

`001_init.sql` で作成:

- `idx_phrases_pack_id`
- `idx_quiz_sessions_user_id` / `idx_quiz_sessions_pack_id`
- `idx_quiz_session_questions_session_id` / `idx_quiz_session_questions_phrase_id`
- `idx_quiz_attempts_session_id` / `idx_quiz_attempts_phrase_id`
- `idx_user_purchases_user_id` / `idx_user_purchases_pack_id`

複合 UNIQUE は制約側でインデックス済み。

---

## 5. RPC

実行権限はすべて `authenticated` のみ（`public` から REVOKE）。`SECURITY DEFINER` + `search_path = public`。内部で必ず `auth.uid()` を使う。

### 5-1. `create_quiz_session(pack_id_param text)`

戻り: `session_id uuid`

1. 未認証 → `Not authenticated`
2. パックなし、無料で `is_active = false`、または有料・非アクティブで未購入 → `Content pack not found`
3. 有料かつアクティブで未購入 → `Purchased pack permission required`（有料・非アクティブで購入済みなら例外で作成可）
4. セッション INSERT
5. `order by random() limit 5` で questions INSERT
6. 5 問に満たなければ例外（トランザクションロールバック）

### 5-2. `consume_heart(session_id_param uuid, phrase_id_param uuid)`

戻り: `remaining_hearts`, `updated_at`

1. 未認証 / 他人セッション / 未割当 phrase は例外
2. attempts INSERT ON CONFLICT DO NOTHING RETURNING id
3. RETURNING なしなら減算せず現状返却
4. ありなら `profiles` を `FOR UPDATE` し、経過分を 30 分単位で回復（上限 5）してから 1 減算（0 未満にしない）。ハート 0 の初回誤答でも attempt は残る

### 5-3. `submit_answer(session_id_param uuid, phrase_id_param uuid, selected_choice_text text, locale_param text default 'en')`

戻り: `is_correct`, `remaining_hearts`, `updated_at`, `correct_choice_text`

1. 未認証 / 他人セッション / 未割当 phrase は例外
2. `choices_by_lang[locale][correct_choice_index]` と選択テキストを比較（`ja` は `en`）
3. 誤答時のみ内部で `consume_heart` を実行
4. 正答・誤答とも `correct_choice_text` を返す（判定後のみ）。`POST /api/quiz/start` と `GET /api/phrases` は正解テキストも `correct_choice_index` も含めない

### 5-4. `sync_profile(p_preferred_language text default null)`

`002_sync_profile.sql`。カラム曖昧性対策として `#variable_conflict use_column`、テーブル別名、`on conflict on constraint profiles_pkey` を使用。

- `auth.identities` に anonymous 以外があれば `is_anonymous = false`
- 言語は引数優先、なければ既存、なければ `en`
- INSERT or UPDATE（ハートは新規行のみ 5。既存行の hearts は上書きしない）

クライアントは引数不一致時に `p_preferred_language` → `preferred_language_param` → 引数なし、の順でリトライする。

---

## 6. RLS 方針

**INSERT / UPDATE / DELETE ポリシーは意図的に作らない。**

| テーブル | SELECT |
|---|---|
| `content_packs` | 全員（非アクティブ含む。購入履歴表示のため） |
| `phrases` | `is_free = true AND is_active = true` のパックのみ |
| `profiles` | `auth.uid() = id` |
| `quiz_sessions` | `auth.uid() = user_id` |
| `quiz_session_questions` | 自分のセッション経由 |
| `user_purchases` | `auth.uid() = user_id` |
| `quiz_attempts` | ポリシーなし（読めない） |

---

## 7. シード教材

Survival（無料）: ありがとう / すみません / 水をください / はい / トイレはどこですか  

Travel（有料 USD 2.99）: いくらですか / 駅はどこですか / おいしい / 助けて / 英語が話せますか  

各 `choices_by_lang` は 8 言語とも 3 要素。`correct_choice_index` はパック内で 0,1,2,0,1。各言語配列のその位置が `translations` と一致する。音声パスは `/audio/*.mp3`（ファイル未配置時はクライアントが生成トーン）。

---

## 8. ブラウザ側の一時ストア

| キー | 場所 | 用途 |
|---|---|---|
| `japanki_pending_checkout_pack` | sessionStorage + localStorage | 連携完了後の Checkout 再開 |
| `japanki_auth_next` | Cookie（Max-Age 600, SameSite=Lax） | OAuth 復帰パス。`safeNextPath` で `/` 始まりかつ `//` 禁止 |
| URL `?checkout=` / `?checkout_pack=` | Query | 復帰時のパック指定 |
| URL `?authError=` | Query | 認証エラー表示 |
