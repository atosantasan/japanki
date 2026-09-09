# Issue #016: 購入済みパックの所有状態判定、UI切り替えおよび二重決済防止ガードの実装

## 1. 発生している問題
- パック購入完了後、クイズは問題なくプレイできるが、トップページに戻ると「トラベルパックを購入」ボタンがそのまま表示され続けている。
- 押し直すと再度 Stripe Checkout 画面が発行されてしまい、二重課金のリスクがある。

## 2. 修正要件
1. **所有状態（isOwned / ownedPackIds）の判定と UI 反映**:
   - AuthContext またはプロファイル同期処理（`syncProfile` / `fetchUserPacks`）にて、ユーザーが所有しているパック ID 一覧を取得・保持する。
   - 対象パックを所有済み（`isOwned === true`）の場合、ボタン表示を「購入」から「学習を始める」（または「プレイする」）に変更し、クリック時は決済ではなくクイズ画面（`/quiz/[packId]`）へ遷移させる。
2. **サーバー側（`/api/checkout`）の二重購入防止ガード**:
   - リクエスト受け取り時、DB（Supabase `user_purchases`）をチェックし、既にそのユーザーが当該パックを所有している場合は 400 Bad Request（「既に購入済みのパックです」）を返し、無駄な Stripe セッション発行を遮断する。
   - 購入権限の付与（INSERT / `grantPurchase`）は引き続き Stripe Webhook 経由のみとし、Checkout API から付与しない。

## 3. 受入条件（Acceptance Criteria）
- [x] `fetchUserPacks` が `user_purchases` から本人の `pack_id` 一覧を返し、`isPackOwned` が所有判定できること。
- [x] AuthContext がプロファイル同期時に所有パック ID を保持し、サインアウト時にクリアすること。
- [x] 所有済みパックのホーム CTA が「購入」ではなく「学習を始める」になり、`/quiz/[packId]` へ遷移すること。
- [x] `/api/checkout` は所有済みパックに対して Stripe セッションを発行せず、400 と「既に購入済みのパックです」を返すこと。
- [x] `/api/checkout` は `user_purchases` への INSERT / `grantPurchase` を行わないこと。
- [x] `npm run verify`（型チェック・Lint・全テスト）が 0 errors で PASS すること。
- [x] `npm run build` が正常に完了すること。

## 4. 解決策と実施内容
1. **所有状態の取得**: `src/lib/billing/user-packs.ts` に `fetchUserPacks` / `isPackOwned` を追加し、`AuthProvider.refreshProfile` が `user_purchases` から `ownedPackIds` を同期する。サインアウト時は空配列にクリアする。
2. **UI 切り替え**: `PurchaseButton` は `isOwned === true` のとき「購入」ではなく `playOwned`（学習を始める）を表示し、`/quiz/[packId]` へ遷移する。
3. **Checkout ガード**: `rejectIfAlreadyOwned` を `/api/checkout` が Stripe セッション作成前に実行し、所有済みなら 400 と「既に購入済みのパックです」を返す。INSERT / `grantPurchase` は行わない。
