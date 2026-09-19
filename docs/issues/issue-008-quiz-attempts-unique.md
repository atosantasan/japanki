# Issue #008: [DB] quiz_attempts の UNIQUE (session_id, phrase_id) 制約の明記とマイグレーション適用

- GitHub: https://github.com/atosantasan/japanki/issues/8
- 出典: `docs/issues/claude_review_01.md` 指摘 2（優先度：高）

## 1. 発生している問題
`quiz_attempts` は「同一 (session_id, phrase_id) は 1 行」と文章のみで、制約表が無い。RPC の `ON CONFLICT DO NOTHING` は UNIQUE/EXCLUSION が実 DB に無いと失敗する。AC-QUIZ-05 の前提。

## 2. 修正要件
1. UNIQUE (session_id, phrase_id) を名前付きでスキーマとドキュメントに明記する。
2. 既存環境向けマイグレーションを適用する。

## 3. 受入条件（Acceptance Criteria）
- [ ] `quiz_attempts` に UNIQUE (session_id, phrase_id) が存在すること。
- [ ] ON CONFLICT が当該制約を対象にできること。
- [ ] 設計書 3-6 に制約表があること。
