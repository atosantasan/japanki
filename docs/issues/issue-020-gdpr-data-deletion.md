# Issue #020: [GDPR] ユーザーデータ削除・エクスポートの API / 導線がない

- GitHub: https://github.com/atosantasan/japanki/issues/20
- 出典: `docs/issues/claude_review_01.md` 低優先（GDPR）

## 1. 発生している問題
EU 圏言語を教材に含むが、削除リクエストに対応する API / 導線が `/privacy` 以外にない。

## 2. 修正要件
1. アカウント削除 API または運用手続の技術導線を整備する。
2. データエクスポートも提供する。

## 3. 受入条件（Acceptance Criteria）
- [x] 削除を依頼・実行できる導線があること（`/account`、確認語 `DELETE`）。
- [x] 削除範囲が定義されていること（学習データ完全削除、購入行は `user_id` SET NULL、Stripe Customer は best-effort 削除）。
