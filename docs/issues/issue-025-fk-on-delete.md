# Issue #025: [DB] FK ON DELETE 挙動が未定義

- GitHub: https://github.com/atosantasan/japanki/issues/25
- 出典: `docs/issues/claude_review_01.md` 低優先（FK ON DELETE）

## 1. 発生している問題
パックやフレーズ削除時の孤児レコード（購入・セッション等）の ON DELETE が設計書に明記されていない。

## 2. 修正要件
1. 各 FK の ON DELETE を DDL と設計書に明記する。

## 3. 受入条件（Acceptance Criteria）
- [ ] 主要 FK の ON DELETE が DDL と設計書で一致していること。
- [ ] パック削除時の購入履歴・セッションの扱いが定義されていること。
