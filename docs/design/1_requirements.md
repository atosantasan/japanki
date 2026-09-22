# 要件定義書：Japanki

> **バージョン履歴**
> | バージョン | 日付 | 変更内容 |
> |---|---|---|
> | v1.0 | 2026-09-19 | 現行実装と PRD v3.2 を突合した as-is 初版 |
> | v1.1 | 2026-09-21 | Issue #15: `completed_at` と `quiz_answers` を実装 |
| v1.2 | 2026-09-21 | Issue #20: アカウント削除・データエクスポート |

---

## 1. プロダクト定義

| 項目 | 内容 |
|---|---|
| プロダクト名 | **Japanki** |
| コンセプト | 海外のライト層・旅行者向け「1回1分（5問）、音で覚える」超軽量日本語学習 PWA |
| ターゲット | アニメファン、日本旅行予定者、漢字・文法学習で挫折した初学者 |
| 1セッション | 5問（1問あたり約10〜15秒、計約1分）。1日に複数セッション可能。5問達成で「1分学習完了！」を表示 |
| 運用連絡 | `japankiadm@gmail.com`（`src/lib/constants/app.ts` の `CONTACT_EMAIL`） |

### 1-1. 対応言語

| 種別 | ロケール | 用途 |
|---|---|---|
| **教材言語（8言語）** | `en`, `zh-TW`, `zh-CN`, `ko`, `th`, `fr`, `de`, `es` | フレーズ訳・3択・パックタイトル。Zod で全キー必須 |
| **UI 言語（9言語）** | 上記 8 言語 + `ja` | `next-intl` の画面文言。`ja` 選択時は訳・3択とも `en` にフォールバック（`toContentLocale("ja") → "en"`） |

デフォルトロケールは `en`。

### 1-2. コンテンツパック（現行シード）

| Pack ID | 種別 | 価格 | フレーズ数 | 説明 |
|---|---|---|---|---|
| `survival` | 無料 | USD 0.00 | 5 | 生存必須フレーズ（ありがとう / すみません 等） |
| `travel` | 有料 | USD 2.99 | 5 | 旅行フレーズ（いくらですか / 駅はどこですか 等） |

定数: `FREE_PACK_ID = "survival"`, `PAID_PACK_ID = "travel"`。

---

## 2. システム概要

ゲスト（匿名 Auth）のまま 1 分クイズを始められ、進捗保存や有料パック購入時だけ Google / Email 連携を要求する。クイズの 5 問割り当てとハート減算はクライアントではなく **Supabase RPC** が確定する。有料フレーズ本文は RLS で遮断し、認証・購入検証済みの `/api/phrases` だけが返す。購入権限の付与は **Stripe Webhook のみ**。

### 技術スタック（実装）

| 項目 | 技術・サービス |
|---|---|
| フロントエンド | Next.js 16.3.4 (App Router) / React 19 / TypeScript |
| スタイリング | Tailwind CSS v4 / Lucide React |
| 多言語 | next-intl v4（`src/app/[locale]/`） |
| バリデーション | Zod v4（8言語辞書・UI messages・フレーズ） |
| PWA | `@serwist/next`（開発時 disable） |
| バックエンド / DB | Supabase（PostgreSQL, Auth, RPC, RLS） |
| 決済 | Stripe Checkout（**都度課金 `mode: "payment"`**）+ Webhook + Customer Portal |
| テスト | Vitest（`src/**/*.test.ts`） |
| インフラ | Vercel |

### PRD との実装差異（要件レベル）

| PRD v3.2 の記述 | 現行実装 |
|---|---|
| PWA に `@ducanh2912/next-pwa` | `@serwist/next` |
| Stripe を Checkout & Webhook とだけ記載 | 都度決済。サブスクリプション課金ではない |
| UI 言語は 8 言語 | UI は 9 言語（`ja` 追加）。教材 JSON は 8 言語のまま |
| 音声ファイル再生 | `/audio/*.mp3` が未配置のため、欠落時は Web Audio の生成トーンへフォールバック |

---

## 3. 対象ユーザーと利用シーン

- **ターゲットユーザー**: 日本旅行やアニメ経由で「耳から短い日本語」を覚えたい非日本語話者。文法ドリルではなく、1分で終わる達成感を求める。
- **利用シーン**:
  - **移動中・待ち時間**: PWA としてホーム画面から起動し、5問だけ解く。
  - **旅行前**: 無料 Survival で最低限を試し、Travel パックを都度購入する。
  - **回線不安定時**: 静的アセットは Service Worker がキャッシュするが、クイズ開始・ハート・購入はオンライン必須。

---

## 4. 機能要件

### ① クイズセッションモジュール

- **F-1-1: サーバー確定の 5 問**: クライアントは `create_quiz_session(pack_id)` を呼び、サーバーがパック内から重複なしランダム 5 問を `quiz_session_questions` に確定する（AC-QUIZ-01〜03）。
- **F-1-2: 不足パックの拒否**: パック内フレーズが 5 未満ならセッションを作らず例外でロールバックする（AC-QUIZ-06）。
- **F-1-3: 有料パック権限**: 有料パックは `user_purchases` に本人レコードがなければ RPC が例外を返す（AC-QUIZ-07）。
- **F-1-4: 表示時シャッフルとサーバー採点**: 3 択は表示時にシャッフルする（`shuffleChoiceOrder`）。正誤判定はクライアント比較ではなく、選択テキストを `POST /api/quiz/submit-answer`（または `submit_answer` RPC）に送りサーバー側で行う。`POST /api/quiz/start` と `GET /api/phrases` は `correct_choice_index` / `correctChoiceText` を返さない。
- **F-1-5: 完了演出**: 5 問終了後に「1-minute complete!」相当の完了画面を出す。`submit_answer` が割当済みの `quiz_session_questions` 件数と `quiz_answers` 件数が一致したとき `quiz_sessions.completed_at` を now() で更新する（Issue #15 / `011`）。正誤は `quiz_answers` に残る。ハート消費は完了判定とは別で、開始成功時の1回だけ（Issue #52）。

### ② ハートモジュール

- **F-2-1: 初期値 5 / 上限 5**: `profiles.hearts` は 0〜5。
- **F-2-2: 開始成功時に1減算**: 5問のセッション確定に成功したとき、`create_quiz_session` がハートをちょうど1つ消費する（Issue #52 / AC-QUIZ-05）。正答・誤答では消費しない。減算前に30分単位の自然回復を反映する。失敗（未認証、未購入、5問未満、ハート不足、レート制限）では消費せずロールバックする。
- **F-2-3: 未割当フレーズ拒否**: セッションに無い `phrase_id` の採点は例外。採点ではハートは減らない。
- **F-2-4: 所有権検証**: セッション `user_id` が `auth.uid()` と一致しない場合は拒否。ハート減算は本人の `profiles` 行を `FOR UPDATE` してから行う。
- **F-2-5: 自然回復**: 30 分で 1 回復（RPC 内計算 + クライアント表示 `recoverHearts`）。満タン時はカウントダウンなし。上限は 5。
- **F-2-6: 0 ハート時**: 回復後の残りが 0 なら開始できない（UI は開始せず、`create_quiz_session` は `No hearts remaining` でセッションを作らない）。開始に成功したセッションは、開始後の残りが 0 でも割り当て済みの5問を解答できる。

### ③ 音声モジュール

- **F-3-1: 自動再生試行**: 問題表示時に `audio_url` の再生を試みる。
- **F-3-2: iOS ブロック時**: `NotAllowedError` なら大きな手動再生ボタンを出す。
- **F-3-3: ファイル欠落時**: 日本語テキストから五声音階トーンを生成してフォールバック再生する。

### ④ 認証・Identity Linking モジュール

- **F-4-1: 匿名起動**: Supabase 設定済みなら起動時に匿名サインインする。
- **F-4-2: Google OAuth**: `linkIdentity`（ゲスト継続）または `signInWithOAuth`（既存アカウントへ切替）。
- **F-4-3: Email Magic Link**: ゲスト継続は `updateUser({ email })`、既存は `signInWithOtp`。
- **F-4-4: 衝突時マージ禁止**: 他アカウントに紐づく Identity では自動マージせず、既存ログインを案内する。
- **F-4-5: プロファイル同期**: `sync_profile` RPC が `is_anonymous` と `preferred_language` を更新。クライアント UPDATE ポリシーは作らない。
- **F-4-6: オープンリダイレクト防止**: 認証後 `next` は同一オリジンの相対パスのみ許可。
- **F-4-7: 自己退会とエクスポート**: 認証済み（匿名含む）が `/account` から JSON エクスポートとアカウント削除できる。削除は確認語 `DELETE` が必要。学習データは CASCADE 削除。`user_purchases` は `user_id` SET NULL で残し `stripe_payment_intent_id` は保持。Stripe Customer は email 検索のうえ `customers.del` を best-effort。

### ⑤ 課金モジュール（都度購入）

- **F-5-1: 匿名購入禁止**: `is_anonymous` または Google/Email 未連携なら Checkout 403（`identity_linking_required`）→ 連携モーダル。
- **F-5-2: 二重購入防止**: 所有済みなら Checkout 400（「既に購入済みのパックです」）。UI は「学習を始める」に切替。
- **F-5-3: Webhook のみ付与**: Success ページは権限を書かない。`checkout.session.completed` の署名検証後に `user_purchases` INSERT。UNIQUE で冪等。Success ページは `GET /api/billing/purchase-status` をポーリングして反映を確認し、確認できてから CTA を有効化する。タイムアウト時は再確認と問い合わせ導線を出す。
- **F-5-4: Customer Portal**: 連携済みユーザーが Stripe 上で領収・支払方法を管理できる。
- **F-5-5: 保留チェックアウト**: 連携前の pack ID を `{ packId, storedAt }` として query / sessionStorage / localStorage に保持する（TTL 10分）。連携完了後は確認ステップを挟み、続ける場合のみ Checkout へ進む。期限切れ・キャンセル・消費後はストレージを削除する。

### ⑥ 有料フレーズ保護モジュール

- **F-6-1: RLS**: 無料パックの `phrases` のみクライアント SELECT 可。有料は遮断。
- **F-6-2: API**: `GET /api/phrases?pack_id=` は Cookie セッションで認証し、Admin クライアントでパック種別・購入・フレーズを取得。Zod 検証後に返却。
- **F-6-3: 未認証 401 / 未購入 403 / 不在 404**。

### ⑦ i18n・法務モジュール

- **F-7-1: ロケール付きルート**: `/{locale}/` 配下。Proxy が next-intl ミドルウェア + Supabase セッション更新を行う。
- **F-7-2: 利用規約 / プライバシー / 特定商取引法**: `/{locale}/terms`, `/privacy`, `/legal`。文言は `messages/*.json`。プライバシーの削除節はアプリ内のエクスポート・退会導線を説明する。
- **F-7-3: UI JSON の Zod 検証**: 8 言語 + `ja` の messages をテストで検証。

### ⑧ PWA モジュール

- **F-8-1: Web Manifest**: 名前 Japanki、standalone、テーマ色 `#e23d28`。
- **F-8-2: Service Worker**: 本番のみ有効。Supabase / Stripe / Google OAuth / `/auth/` は NetworkOnly でキャッシュしない。

---

## 5. 非機能要件

- **起動の軽さ**: 1 画面で「5問・音・3択」に到達できること。文法解説や長いオンボーディングを置かない。
- **セキュリティ**:
  - `SUPABASE_SECRET_KEY` / `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` を Client Component と `NEXT_PUBLIC_` に出さない。
  - テーブル変更は SECURITY DEFINER RPC またはサーバー Admin のみ。クライアント INSERT ポリシーを作らない。
  - Stripe Webhook は署名検証必須。
- **検証ゲート**: `npm run verify`（type-check + lint + test）と `npm run build` が通ること。
- **多言語完全性**: 教材 JSON は 8 言語キー欠落を Zod で実行時拒否する。
- **クロスプラットフォーム**: iOS Safari / Android Chrome / デスクトップ。PWA スタンドアロンをサポートする。

---

## 6. クイズ受入条件（AGENTS.md より）

| ID | 条件 |
|---|---|
| AC-QUIZ-01 | 1 セッションにサーバー確定の重複なし 5 `phrase` |
| AC-QUIZ-02 | 同一セッションで同じ phrase を複数回出題しない |
| AC-QUIZ-03 | 選択パック以外の問題を含めない |
| AC-QUIZ-04 | 回復後ハートが 0 なら `create_quiz_session` はセッションを作らず例外 |
| AC-QUIZ-05 | 開始成功 1 回につきハートをちょうど 1 つ減算する。正答・誤答では減算しない |
| AC-QUIZ-06 | 5 件未満ならセッション未作成でロールバック |
| AC-QUIZ-07 | 有料パックは本人の `user_purchases` が無ければ RPC 例外 |

---

## 7. 現行の既知ギャップ（as-is）

| 項目 | 状態 |
|---|---|
| フレーズ音声ファイル `public/audio/*.mp3` | 未配置。生成トーンへフォールバック |
| PWA アイコン `/icon-192.png`, `/icon-512.png` | Manifest が参照。リポジトリ `public/` には未配置。テストでパス規約を検証 |
| `profiles.last_x_shared_at` | スキーマのみ。X シェア回復は未実装 |
| ハート 0 での開始ロック | 回復後ハートが 0 なら開始不可。開始済みの5問は解答できる（Issue #52） |
| オフラインでの新規セッション | 不可（RPC / API 必須） |
| Webhook と Success のレース | Success 直後のクイズ開始が未購入扱いになり得る |
