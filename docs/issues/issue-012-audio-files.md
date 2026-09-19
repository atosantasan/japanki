# Issue #012: [ASSETS] 音声ファイル（/public/audio/*.mp3）が未配置

- GitHub: https://github.com/atosantasan/japanki/issues/12
- 出典: `docs/issues/claude_review_01.md` 指摘 5（優先度：中）

## 1. 発生している問題
コンセプトは「音で覚える」だが音声ファイルが未配置で生成トーンにフォールバックする。

## 2. 修正要件
1. 各フレーズの音声ファイルを配置する。
2. 存在チェックをテストに入れる。

## 3. 受入条件（Acceptance Criteria）
- [ ] シードの audio_url に対応するファイルがあること。
- [ ] 欠落時にテストが失敗すること。
