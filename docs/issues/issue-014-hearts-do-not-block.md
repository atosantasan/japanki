# Issue #014: [UX] ハートが解答を止めずゲーミフィケーションとして機能していない

- GitHub: https://github.com/atosantasan/japanki/issues/14
- 出典: `docs/issues/claude_review_01.md` 指摘 7（優先度：中）

## 1. 発生している問題
F-2-6 が「0 ハートでも解答を止めない」だったため、ハート切れでも遊べてしまう。

## 2. 修正要件
1. 回復後ハートが 0 なら解答できない（プロダクト判断：ブロックする）。
2. UI と採点 API の両方で止める。RPC は 0 未満にしない。

## 3. 受入条件（Acceptance Criteria）
- [x] 設計判断が PRD / 要件に明記されていること。
- [x] 実装が当該判断と一致していること。

## 4. 実施内容
- `canPlayWithHearts` で回復後ハートが 0 なら選択肢を disabled にし、クリックも無視する。
- `submitAnswerForRequest` は remaining hearts が 0 なら 403 で採点しない。
- F-2-6 を「0 ハートなら解答不可」に更新した。
