# Issue #019: [UX] Stripe Checkout 成功直後の Webhook 遅延で購入がロックされる

- GitHub: https://github.com/atosantasan/japanki/issues/19
- 出典: `docs/issues/claude_review_01.md` 指摘 12（優先度：中）

## 1. 発生している問題
支払い直後に Travel クイズへ進むと paidLocked になり得る。対策が再読み込み任せ。

## 2. 修正要件
1. Success ページで Webhook 到達をポーリングしてから CTA を出す。

## 3. 受入条件（Acceptance Criteria）
- [x] 購入反映前は開始 CTA を出さない、または待ち状態を示すこと。
- [x] 反映後にクイズへ進めること。
