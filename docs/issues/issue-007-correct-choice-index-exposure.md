# Issue #007: [SECURITY] 正解インデックス（correct_choice_index）のクライアント露呈と採点のサーバー移管

- GitHub: https://github.com/atosantasan/japanki/issues/7
- 出典: `docs/issues/claude_review_01.md` 指摘 1（優先度：高）

## 1. 発生している問題
`phrases.correct_choice_index` が `/api/phrases` レスポンスおよび公開用 Zod スキーマに含まれ、採点がクライアント側（`shuffleChoices` + `isCorrectChoice`）で行われている。DevTools の Network タブで正解番号が分かる。誤答時のみ `consume_heart` が呼ばれるため、この抜け道ではハートが減らない。

## 2. 修正要件
1. `/api/phrases` と公開 Zod スキーマから `correct_choice_index` を除外する。
2. 正誤判定をサーバー側 RPC/API（`submit_answer` 等）へ移管する。

## 3. 受入条件（Acceptance Criteria）
- [x] 公開フレーズ payload に `correct_choice_index` が含まれないこと。
- [x] サーバーが選択テキストで正誤判定すること。
- [x] 誤答時のみハート減算すること。

## 4. 今回の実施内容（ローカル実装・未コミット / Human Gate 待ち）
- `PublicPhraseRecordSchema` で `correct_choice_index` を omit。`GET /api/phrases` の SELECT からも除外。
- 表示シャッフルは `shuffleChoiceOrder`（正解インデックス非依存）。
- RPC `submit_answer` が所有権・割当 phrase を検証し、選択テキストと DB 上の正解テキストを比較。
- 誤答時のみ内部で `consume_heart` を実行。`QuizPlay` は `submitAnswer` の結果待ち。
- 残作業: 改修コード未コミット、生産 DB へ `004` 未適用。無料パックの RLS SELECT と公開 API の `translations` 突き合わせは残リスク。
- GitHub コメント: https://github.com/atosantasan/japanki/issues/7#issuecomment-5740949603
