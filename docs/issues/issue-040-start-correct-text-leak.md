# Issue #040: [SECURITY] /api/quiz/start の correctChoiceText 事前配布を撤廃

- GitHub: https://github.com/atosantasan/japanki/issues/40

## 1. 発生している問題
Issue #34 の即時フィードバックのため、開始 API が 5 問分の `correctChoiceText` を解答前に返していた。004 / Issue #7 で塞いだ正解のクライアント露出が別経路で復活している。

## 2. 修正要件
1. `POST /api/quiz/start` から正解テキストを削除する。
2. 正誤表示は `POST /api/quiz/submit-answer` の応答を待つ。
3. 起動チェーンの一本化は維持する。

## 3. 受入条件（Acceptance Criteria）
- [x] start API に正解を特定できる情報が含まれないこと
- [x] 正誤・ハート・不正解時の正解表示が submit-answer 根拠であること
