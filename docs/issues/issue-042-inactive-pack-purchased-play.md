# Issue #042: [QUIZ] is_active=false のパックで既存購入者がプレイ不能になる

- GitHub: https://github.com/atosantasan/japanki/issues/42

## 1. 発生している問題
`is_active` は一時非表示の意図だが、`create_quiz_session` と `GET /api/phrases` が false を一律 not found にしていた。購入済みユーザーもプレイできなくなっていた。

## 2. 修正要件
1. 有料・非アクティブ・購入済みならセッション作成とフレーズ取得を許可する。
2. 有料・非アクティブ・未購入、および無料・非アクティブは従来どおり not found。
3. `/api/checkout` は変更しない。

## 3. 受入条件（Acceptance Criteria）
- [x] 購入済みユーザーは `is_active=false` でもプレイ継続できる
- [x] 無料パック・未購入ユーザーの挙動は変わらない
