# Issue #022: [UX] 音声自動再生ブロック処理が iOS 限定で書かれている

- GitHub: https://github.com/atosantasan/japanki/issues/22
- 出典: `docs/issues/claude_review_01.md` 低優先（自動再生）

## 1. 発生している問題
F-3-2 が iOS ブロック時限定。Chrome 等にも自動再生ポリシーがある。

## 2. 修正要件
1. 自動再生失敗をプラットフォーム非依存で扱い、手動再生ボタンを出す。

## 3. 受入条件（Acceptance Criteria）
- [ ] iOS 以外の NotAllowedError でも手動再生 UI が出ること。
