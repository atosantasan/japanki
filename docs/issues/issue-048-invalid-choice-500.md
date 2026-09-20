# Issue #048: [BUG] 不正な選択肢文字列で submit_answer が 500 を返す

- GitHub: https://github.com/atosantasan/japanki/issues/48

## 1. 発生している問題
`submit_answer` の `Invalid choice` が BFF で HTTP 500 になっていた。

## 2. 修正要件
1. BFF は `{ error: "invalid_choice" }` を HTTP 409 で返す。
2. QuizPlay はクラッシュせず、再読み込みを案内する。

## 3. 受入条件（Acceptance Criteria）
- [x] 選択肢にない文字列は 500 ではなく 409 `invalid_choice`
- [x] クライアントはリカバリ手段（問題の再読み込み）を出す
