# Issue #011: [CONTENT] 各パックが5フレーズしかなくランダム5問にバリエーションがない

- GitHub: https://github.com/atosantasan/japanki/issues/11
- 出典: `docs/issues/claude_review_01.md` 指摘 4（優先度：中）

## 1. 発生している問題
Survival / Travel ともフレーズが 5 件のため、ランダム 5 問は順番シャッフルのみ。初回でコンテンツを使い切る。

## 2. 修正要件
1. 各パックのシード問題数を、ランダム 5 問抽出が意味を持つ水準まで増やす。

## 3. 受入条件（Acceptance Criteria）
- [ ] 各パックの phrase 数が 5 を超えること。
- [ ] 連続セッションで出題セットが変わり得ること。
