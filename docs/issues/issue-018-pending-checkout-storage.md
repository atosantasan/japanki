# Issue #018: [UX] 保留 Checkout の localStorage が共有端末で意図しない決済導線になる

- GitHub: https://github.com/atosantasan/japanki/issues/18
- 出典: `docs/issues/claude_review_01.md` 指摘 11（優先度：中）

## 1. 発生している問題
pending pack を localStorage にも保持するため、共有 PC で別ユーザーが Google 連携しただけで Checkout に飛ばされ得る。

## 2. 修正要件
1. sessionStorage のみにする、または使用後に必ず破棄する。
2. 自動遷移前の再確認を検討する。

## 3. 受入条件（Acceptance Criteria）
- [ ] 別ユーザーで前の pending pack が自動 Checkout されないこと。
- [ ] pending は使用後に消えること。
