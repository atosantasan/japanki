# Issue #013: [PWA] アイコン（/icon-192.png, /icon-512.png）が未配置

- GitHub: https://github.com/atosantasan/japanki/issues/13
- 出典: `docs/issues/claude_review_01.md` 指摘 6（優先度：中）

## 1. 発生している問題
Manifest が参照する PWA アイコンが `public/` に無く、ホーム画面追加時にアイコンが欠ける。

## 2. 修正要件
1. 192 / 512 のアイコンを配置する。
2. 存在チェックを入れる。

## 3. 受入条件（Acceptance Criteria）
- [ ] Manifest 参照パスに実ファイルがあること。
- [ ] 欠落時にテストが失敗すること。
