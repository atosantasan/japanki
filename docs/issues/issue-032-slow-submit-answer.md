# Issue #032: [BUG] 回答ボタン押下から正誤表示まで4〜5秒かかる

- GitHub: https://github.com/atosantasan/japanki/issues/32

## 1. 発生している問題
選択肢を押してから正解／不正解が出るまで 4〜5 秒かかる。

`POST /api/quiz/submit-answer` が認証・セッション・割当・phrase・ハートを直列の Supabase 往復で実行している。初回はサーバーレスのコールドスタートも重なる。

## 2. 修正要件
1. 認証後の参照を並列化し、ラウンドトリップ数を減らす。
2. 初回クリック前に API をウォームアップする。
3. クリック直後に選択中状態を出し、二重送信しない。
4. 未認証・他人セッション・未割当の拒否と誤答時のみ `consume_heart` は維持する。

## 3. 受入条件（Acceptance Criteria）
- [x] 正誤表示までのサーバー往復が直列の多段 SELECT に依存しないこと。
- [x] 誤答時のみ consume_heart を呼ぶこと。
- [x] 未認証・他人セッション・未割当は従来どおり拒否すること。
- [x] `npm run verify` が PASS すること。

## 4. 実施内容
- セッション所有・問題割当・phrase・ハート参照を `Promise.all` で並列化した。
- セッション開始後に `GET /api/quiz/submit-answer` で API をウォームアップする。
- クリック直後に選択中状態を出し、二重送信しない。
- `/api/` は Service Worker キャッシュをバイパスする。
