# Issue #028: [BUG] ヘッダーはハート満タンなのにクイズが「ハートがありません」と出してプレイできない

- GitHub: https://github.com/atosantasan/japanki/issues/28

## 1. 発生している問題
クイズ画面でヘッダーはハート 5 / 「満タン」なのに、問題上に「ハートがありません。時間とともに回復します。」が出る。選択肢を押しても進行できない。

ヘッダーは `recoverHearts` で回復分を加算する一方、`QuizPlay` は保存値 `profiles.hearts === 0` だけで空警告を出している。

## 2. 修正要件
1. 空ハート警告は回復後の表示ハートで判定する。
2. ハート 0 でも解答は止めない（F-2-6）。
3. `submitAnswer` 失敗時はエラーを表示する。

## 3. 受入条件（Acceptance Criteria）
- [x] stored hearts が 0 でも回復で満タンなら `heartsEmpty` を出さないこと。
- [x] ヘッダーのハート数とクイズ警告の有無が一致すること。
- [x] 選択肢は feedback 中以外クリックできること。
- [x] submit_answer 失敗時に画面へエラーが出ること。

## 4. 実施内容
- `shouldShowHeartsEmpty` でヘッダーと同じ `recoverHearts` 基準の表示ハートを使う。
- 保存値が 0 でも回復済みなら空警告を出さない。ハート 0 でも選択肢は disabled にしない。
- `submitAnswer` 失敗は握りつぶさず `submitError` を表示する。
