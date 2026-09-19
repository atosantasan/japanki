# Issue #024: [DB] content_packs.price_usd が numeric(4,2) で桁不足

- GitHub: https://github.com/atosantasan/japanki/issues/24
- 出典: `docs/issues/claude_review_01.md` 低優先（price_usd）

## 1. 発生している問題
`numeric(4,2)` では将来 $100 超のパックを格納できない。

## 2. 修正要件
1. `numeric(6,2)` 等へ見直し、マイグレーションする。

## 3. 受入条件（Acceptance Criteria）
- [ ] $100 以上を格納できること。
- [ ] 既存 $2.99 が壊れないこと。
