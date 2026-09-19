# Issue #030: [BUG] 回答クリックで「このパックを開始できませんでした」と止まってプレイできない

- GitHub: https://github.com/atosantasan/japanki/issues/30

## 1. 発生している問題
リロード後にクイズを開始し、選択肢をクリックすると `Quiz.startError`（このパックを開始できませんでした）が出て進行できない。

採点はクライアントから `submit_answer` RPC を呼ぶが、本番 DB に `004` が無いと関数未定義で失敗する。失敗表示がパック開始失敗になっている。

## 2. 修正要件
1. 採点を `POST /api/quiz/submit-answer` に移す（Admin で正解参照、誤答時は既存 `consume_heart`）。
2. 失敗メッセージを解答判定失敗にする。
3. 失敗後も同じ問題を再選択できる。

## 3. 受入条件（Acceptance Criteria）
- [x] 正答・誤答をサーバー側で判定できること。
- [x] 誤答時のみ consume_heart を呼ぶこと。
- [x] 未認証・他人セッション・未割当 phrase は拒否すること。
- [x] 失敗時の文言がパック開始失敗ではないこと。
- [x] `npm run verify` が PASS すること。

## 4. 実施内容
- 採点を `POST /api/quiz/submit-answer` に移し、Admin で `correct_choice_index` を参照して判定する。
- 誤答時のみ既存の `consume_heart` を呼ぶ（`submit_answer` RPC 未適用でも動く）。
- 失敗メッセージを `Quiz.gradeError` にし、同じ問題を再選択できる。
