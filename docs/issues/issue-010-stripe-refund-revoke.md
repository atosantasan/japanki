# Issue #010: [BILLING] 返金・チャージバック時に user_purchases が失効しない

- GitHub: https://github.com/atosantasan/japanki/issues/10
- 出典: `docs/issues/claude_review_01.md` 指摘 3（優先度：高）返金時の剥奪

## 1. 発生している問題
`charge.refunded` 等でアクセス権を剥奪する処理が無く、返金後も Travel パックが使える。

## 2. 修正要件
1. 返金イベントで該当 `user_purchases` を削除または失効する。
2. 購入付与時に `stripe_payment_intent_id` 等の突合キーを保存する。

## 3. 受入条件（Acceptance Criteria）
- [ ] 返金後に該当パックへアクセスできないこと。
- [ ] 突合キーが購入行に保存されること。
