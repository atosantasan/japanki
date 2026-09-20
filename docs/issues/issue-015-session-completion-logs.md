# Issue #015: [LOG] quiz_sessions.completed_at 未更新および正答時の quiz_attempts 未記録

- GitHub: https://github.com/atosantasan/japanki/issues/15
- 出典: `docs/issues/claude_review_01.md` 指摘 8（優先度：中）

## 1. 発生している問題
完了時刻が未更新で、正答は記録されない。セッション完了や正答率を DB から再構築できない。

## 2. 修正要件
1. 5 問完了時に `completed_at` を更新する。
2. 正答も学習ログとして記録する。

## 3. 受入条件（Acceptance Criteria）
- [x] 完了セッションの completed_at が非 NULL であること。
- [x] 5 問の正誤を DB から再構築できること。

## 4. 実装メモ

- `011_quiz_session_completion.sql` が `quiz_answers` を追加し、`submit_answer` が割当数一致時に `completed_at` を更新する。
- `quiz_attempts` は初回誤答のまま。分析用ビューは作らない（ダッシュボード未実装、PostgREST 暴露面を増やさない）。
- 本番 Supabase への `011` 適用は別途手動。
