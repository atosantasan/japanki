# Issue #009: [BILLING] Stripe Webhook の payment_status 未チェック

- GitHub: https://github.com/atosantasan/japanki/issues/9
- 出典: `docs/issues/claude_review_01.md` 指摘 3（優先度：高）unpaid ガード

## 1. 発生している問題
非同期決済では `checkout.session.completed` が `payment_status = unpaid` のまま飛ぶことがある。未払いのまま `user_purchases` が付与され得る。

## 2. 修正要件
1. `payment_status === "paid"` のときのみ購入付与する。
2. 非同期完了は `checkout.session.async_payment_succeeded` で付与する。

## 3. 受入条件（Acceptance Criteria）
- [x] unpaid の completed では購入を付与しないこと。
- [x] paid の async_payment_succeeded では購入を付与すること。
- [x] Success URL からの付与を行わないこと。

## 4. 今回の実施内容（ローカル実装・未コミット / Human Gate 待ち）
- `checkout.session.completed` と `checkout.session.async_payment_succeeded` のみ購入処理対象。
- `payment_status !== "paid"` では `grantPurchase` しない。
- Success URL からの付与は行わない（既存方針維持）。
- 残作業: 改修コード未コミット、Stripe Dashboard で `async_payment_succeeded` の Webhook 購読追加が必要。
- GitHub コメント: https://github.com/atosantasan/japanki/issues/9#issuecomment-5740949743
