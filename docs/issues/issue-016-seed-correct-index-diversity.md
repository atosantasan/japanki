# Issue #016: [TEST] シード全問の correct_choice_index = 0 によるシャッフルバグ死角

- GitHub: https://github.com/atosantasan/japanki/issues/16
- 出典: `docs/issues/claude_review_01.md` 指摘 9（優先度：中）

## 1. 発生している問題
シードは全問正解が先頭のため、無シャッフルバグがあっても見た目 QA では気づけない。

## 2. 修正要件
1. テスト用シードの正解位置を分散させる。

## 3. 受入条件（Acceptance Criteria）
- [ ] シードの correct_choice_index が 0 以外を含むこと。
- [ ] 無シャッフルだと誤答になるケースをテストで検知できること。
