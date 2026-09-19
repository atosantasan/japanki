# Issue #007: [SECURITY] 正解インデックス（correct_choice_index）のクライアント露呈と採点のサーバー移管

- GitHub: https://github.com/atosantasan/japanki/issues/7
- 出典: `docs/issues/claude_review_01.md` 指摘 1（優先度：高）

## 1. 発生している問題
`phrases.correct_choice_index` が `/api/phrases` レスポンスおよび公開用 Zod スキーマに含まれ、採点がクライアント側（`shuffleChoices` + `isCorrectChoice`）で行われている。DevTools の Network タブで正解番号が分かる。誤答時のみ `consume_heart` が呼ばれるため、この抜け道ではハートが減らない。

## 2. 修正要件
1. `/api/phrases` と公開 Zod スキーマから `correct_choice_index` を除外する。
2. 正誤判定をサーバー側 RPC/API（`submit_answer` 等）へ移管する。

## 3. 受入条件（Acceptance Criteria）
- [ ] 公開フレーズ payload に `correct_choice_index` が含まれないこと。
- [ ] サーバーが選択テキストで正誤判定すること。
- [ ] 誤答時のみハート減算すること。
