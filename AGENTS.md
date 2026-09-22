# Japanki - Autonomous Agent Development Rules (AGENTS.md)

## 1. 開発ループ思想 (TDD & Multi-stage Verification Loop)

AIエージェントは単にコードを書くだけではなく、以下の 8 ステップのループを遵守すること。
「仕様理解 → テスト作成 → 実装 → 検証 → 修復 → 人間によるレビュー」を経ずに完了とみなしてはならない。

[ Step 1: 仕様理解 & Acceptance Criteria (AC) 抽出 ]
│
[ Step 2: テストコード作成 (TDD) ※この時点では失敗すること ]
│
[ Step 3: 機能実装 (Implementation) ]
│
[ Step 4: 多段検証 (`npm run verify`) ] ─── (失敗) ┐
│                                           │ (修復ループ: 最大10反復)
├─── (全PASS) ──────────────────────────────┘
▼
[ Step 5: セキュリティ＆品質監査 (Security & Quality Check) ]
│
[ Step 6: プロダクションビルド (`npm run build`) ]
│
[ Step 7: Phase成果報告 & Human Gate (人間のGoサイン待ち) ]
│
[ Step 8: 次のPhaseへの提案 ]

---

## 2. エラー修復 & ループ停止の条件 (Loop Constraints)

* **修復上限**: 異なるエラーに対する自動修復は最大10反復まで認める。
* **即時停止・人間への報告条件 (Human Gate)**:
1. 同一エラーが 3 回連続で発生した場合（ループの泥沼化防止）。
2. データベーススキーマや破壊的変更（Data Destruction）が必要となった場合。
3. アカウント連携において「既存アカウントとのマージ/衝突」が発生した場合。
4. PRDの仕様解釈に曖昧さが生じた場合。



---

## 3. Definition of Done (完了の定義)

すべてのタスクは、以下の条件を全件クリアした場合のみ「完了提案」を行うこと。

* [ ] PRD v3.2 の仕様および Acceptance Criteria (AC) を完全に満たしている
* [ ] TypeScript type-check 0 errors (`npm run type-check`)
* [ ] ESLint 0 errors (`npm run lint`)
* [ ] Unit / Integration Tests 全件PASS (`npm run test`)
* [ ] `npm run build` がエラーなく成功する
* [ ] Supabase RLS を意図せず迂回していない（クライアントからの直接INSERTポリシーを作成していないこと）
* [ ] 「5. セキュリティ＆品質チェックリスト」の全項目をクリアしている
* [ ] 選択肢シャッフル処理関数 (`shuffleChoices`) のテストがPASSし、正解判定のズレがない
* [ ] 全8言語（en, zh-TW, zh-CN, ko, th, fr, de, es）の JSON データの Zod バリデーションが成功している
* [ ] console.log 等の不要なデバッグログ、TODO/FIXME コメントが残っていない（※適切なエラーログ監視用 console.error は許可）

---

## 4. 自動検証ゲート設定 (`package.json`)

エージェントは変更を加えた後、必ず以下のコマンド群を実行して検証すること。

"scripts": {
"dev": "next dev",
"build": "next build",
"start": "next start",
"lint": "next lint",
"type-check": "tsc --noEmit",
"test": "vitest run",
"verify": "npm run type-check && npm run lint && npm run test"
}

※ `npm run lint` については、初期化時に採用されている Next.js バージョンの最適な ESLint CLI 実行方式を確認・設定すること。

---

## 5. セキュリティ ＆ 品質具体的なチェックリスト (Security & Quality Checklist)

エージェントは Step 5 において、以下の項目を個別かつ具体的に検証すること。

* [ ] 1. `SUPABASE_SECRET_KEY` および `STRIPE_SECRET_KEY` が Client Component (`.tsx` や `NEXT_PUBLIC_`) 内に一切存在しないこと。
* [ ] 2. `NEXT_PUBLIC_` 以外の秘密情報が Client Bundle に含まれていないこと。
* [ ] 3. `/api/phrases` は Supabase Auth による認証状態を厳格に検証していること。
* [ ] 4. `/api/phrases` は対象有料パックの購入権限 (`user_purchases`) を検証していること。
* [ ] 5. Stripe Webhook は `STRIPE_WEBHOOK_SECRET` による署名検証を行っていること。
* [ ] 6. Success URL やフロントエンドからのリクエストのみで購入権限を付与していないこと（Webhook経由のみ）。
* [ ] 7. RPC (`create_quiz_session`, `consume_heart`) は内部で `auth.uid()` を使用していること。ハート減算は `create_quiz_session` が本人の `profiles` を更新する。
* [ ] 8. RPC (`create_quiz_session`) は回復後ハートが 0 のときセッションを作らず、5問の割り当て成功後に同一トランザクションでハートを1つだけ減算すること。`consume_heart` は減算しない。
* [ ] 9. クライアントから `quiz_attempts` や `quiz_session_questions` へ直接 INSERT できないよう RLS で保護されていること（INSERT ポリシー未定義）。
* [ ] 10. 他ユーザーの `user_purchases` や `profiles` 情報を取得・変更できないこと。
* [ ] 11. 教材（Phrases）の8言語辞書データの投入時は、Zod スキーマで全言語キーの存在を検証し、人間による翻訳レビューを通していること。

---

## 6. クイズ機能の受入条件 (Acceptance Criteria)

* **AC-QUIZ-01**: 1つのセッションには、サーバー側で確定された重複のない正確に5つの `phrase` が割り当てられること。
* **AC-QUIZ-02**: 同一セッション内で同じ問題（`phrase`）が複数回出題されないこと。
* **AC-QUIZ-03**: 選択されたパック以外の問題がセッションに含まれないこと。
* **AC-QUIZ-04**: 回復後のハートが 0 のとき `create_quiz_session` はセッションを作成せず例外を返すこと。
* **AC-QUIZ-05**: 開始成功 1 回につきハートをちょうど 1 つ減算すること。正答・誤答では減算しないこと。
* **AC-QUIZ-06**: 選択されたパックに5件未満の `phrase` しか存在しない場合、`create_quiz_session` はセッションを作成せず例外を返してロールバックすること。
* **AC-QUIZ-07**: 有料パックの場合、`user_purchases` に本人の購入記録が存在しないユーザーは `create_quiz_session` を実行できず例外を返すこと。