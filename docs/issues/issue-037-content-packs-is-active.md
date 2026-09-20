# Issue #037: [DB] content_packs に論理削除用 is_active フラグがない

- GitHub: https://github.com/atosantasan/japanki/issues/37
- 出典: Issue #25 の TODO（パックは ON DELETE RESTRICT のため物理削除しない）

## 1. 発生している問題
パックを誤削除から守るため FK は ON DELETE RESTRICT にした。廃止する場合の論理削除フラグがなく、カタログから外せない。

## 2. 修正要件
1. `content_packs.is_active boolean NOT NULL DEFAULT true` を追加する。
2. `create_quiz_session` は非アクティブパックを「Content pack not found」として拒否する。
3. 無料フレーズ SELECT（RLS）でも非アクティブパックを除外する。

## 3. 受入条件（Acceptance Criteria）
- [x] `is_active` カラムが追加されていること
- [x] 非アクティブパックでは新規クイズセッションを作成できないこと
- [x] 非アクティブパックの無料フレーズをクライアント SELECT できないこと
