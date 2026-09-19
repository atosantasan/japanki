# Issue #008: [DB] quiz_attempts の UNIQUE (session_id, phrase_id) 制約の明記とマイグレーション適用

- GitHub: https://github.com/atosantasan/japanki/issues/8
- 出典: `docs/issues/claude_review_01.md` 指摘 2（優先度：高）

## 1. 発生している問題
`quiz_attempts` は「同一 (session_id, phrase_id) は 1 行」と文章のみで、制約表が無い。RPC の `ON CONFLICT DO NOTHING` は UNIQUE/EXCLUSION が実 DB に無いと失敗する。AC-QUIZ-05 の前提。

## 2. 修正要件
1. UNIQUE (session_id, phrase_id) を名前付きでスキーマとドキュメントに明記する。
2. 既存環境向けマイグレーションを適用する。

## 3. 受入条件（Acceptance Criteria）
- [x] `quiz_attempts` に UNIQUE (session_id, phrase_id) が存在すること。
- [x] ON CONFLICT が当該制約を対象にできること。
- [x] 設計書 3-6 に制約表があること。

## 4. 今回の実施内容（ローカル実装・未コミット / Human Gate 待ち）
- `001_init.sql` に `quiz_attempts_session_id_phrase_id_key` を名前付き UNIQUE で明記。
- `004_submit_answer_and_billing_guards.sql` で既存 DB 向けに同制約を `IF NOT EXISTS` 相当で追加。
- `docs/design/4_db_schema.md` 3-6 に制約表を追加。
- 残作業: 改修コード未コミット、既存 Supabase へ `004` 未適用。
- GitHub コメント: https://github.com/atosantasan/japanki/issues/8#issuecomment-5740949666
