# [BUG] OAuthリダイレクト後の AuthContext 同期遅延および Stripe 決済自動遷移の不具合

## 1. 現状の不具合挙動
- Google OAuth 完了後にアプリ画面に戻った際、AuthContext の更新（isLoggedIn / user）が即座に反映されずヘッダーが「ゲスト」のままになる。
- ログイン状態の同期遅延により、購入保留中データ（`pendingCheckoutPackId`）の検出・Stripe 決済画面（`/api/checkout`）への自動リダイレクトが発火しない（または未認証で拒否される）。

## 2. 期待される挙動
- OAuth 復帰時、Supabase セッション確立を即時検知し AuthContext を更新。
- 保留中のパックIDが存在する場合は、即座に Stripe Checkout を呼び出してカード決済画面へシームレスに自動遷移する。

## 3. 受入条件（Acceptance Criteria）
- [ ] OAuth 復帰後に画面リロードなしでログイン状態が同期されること。
- [ ] 保留中のパックIDがリダイレクト跨ぎ（Storage）で確実に保持・復元されること。
- [ ] ログイン完了を判定後、自動で Stripe 決済画面へ切り替わること。
- [ ] `npm run verify`（全テスト、型チェック、リント）が 0 error で PASS すること。
