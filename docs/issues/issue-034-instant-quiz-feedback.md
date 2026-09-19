# Issue #034: [BUG] 出題準備と正誤表示が遅く、当初の即時反応に戻っていない

- GitHub: https://github.com/atosantasan/japanki/issues/34

## 1. 発生している問題
回答の正誤がサーバー待ちのため数秒かかる。問題の用意も、セッション作成・phrases・割当の直列往復で遅い。

## 2. 修正要件
1. 正誤は開始APIで渡した `correctChoiceText` を使ってクライアント即時表示する。ハート減算は既存 submit-answer を非同期で呼ぶ。
2. 出題は `POST /api/quiz/start` 1回で返す。
3. `/api/phrases` には `correct_choice_index` を出さない。
4. ハート更新でクイズが再起動しない。

## 3. 受入条件（Acceptance Criteria）
- [x] 選択肢クリック後、正誤がサーバー応答を待たずに出ること。
- [x] 問題表示がクライアント側の多段 fetch/RPC に依存しないこと。
- [x] 誤答時のみ consume_heart が呼ばれること。
- [x] `npm run verify` が PASS すること。

## 4. 実施内容
- `POST /api/quiz/start` でセッション作成・5問・ハートを一度に返す。
- 正誤は `correctChoiceText` のクライアント比較で即時表示し、ハート同期だけ submit-answer を非同期実行する。
- ホーム描画時に採点/開始 API をウォームアップする。
