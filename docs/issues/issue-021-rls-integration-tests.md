# Issue #021: [TEST] RLS ポリシーの検証がマイグレーション静的解析のみ

- GitHub: https://github.com/atosantasan/japanki/issues/21
- 出典: `docs/issues/claude_review_01.md` 低優先（RLS テスト）

## 1. 発生している問題
実 Postgres 上で RLS が意図通り動く統合テストがない。静的チェックでは検知しにくい。

## 2. 修正要件
1. 認証ユーザー別に SELECT / INSERT 拒否を Postgres 上で検証する。

## 3. 受入条件（Acceptance Criteria）
- [ ] 他ユーザーの purchases / profiles が読めないこと。
- [ ] 保護テーブルへのクライアント INSERT が拒否されること。
