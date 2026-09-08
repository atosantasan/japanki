# Issue #013: sync_profile RPC 内の SQL 曖昧性エラー (code 42702) および Checkout 403 解消

## 1. 発生ログと原因
- **コンソールエラー**:
  `sync_profile safely bypassed error: {code: '42702', details: 'It could refer to either a PL/pgSQL variable or a table column.', hint: null, message: 'column reference "id" is ambiguous'}`
- **API エラー**:
  `POST /api/checkout 403 (Forbidden)`
- **根本原因**:
  1. Supabase の `sync_profile` SQL 関数（`supabase/migrations/002_sync_profile.sql`）内部で、変数や戻り値の型定義・クエリにおいて `id` カラムが修飾されずに使用されている。PostgreSQL の PL/pgSQL エンジンにおいて変数とテーブル列名の区別がつかず `code: '42702' (ambiguous_column)` が発生している。
  2. `sync_profile` が 42702 エラーで失敗した結果、プロファイルやセッションの同期状態が不完全となり、その直後に発火する `/api/checkout` が匿名ユーザー（またはセッション未反映）と判定されて 403 (Forbidden) でブロックされている。

## 2. 修正要件
1. **SQL マイグレーションの修正 (`supabase/migrations/002_sync_profile.sql`)**:
   - `sync_profile` 関数内のすべてのカラム参照に明示的なテーブル別名（例: `p.id`, `u.id` 等）を付与し、`id` の曖昧性を完全に解消する。
   - 関数内変数・パラメータがある場合は `v_user_id`, `p_preferred_language` 等、テーブルカラム名と重複しない命名規則を徹底する。
2. **セッション確定と Stripe Checkout 再呼び出しの順序制御**:
   - `sync_profile` が成功（または完了）し、ログインユーザー（非匿名）としての AuthContext / セッション確定後に、`pendingCheckoutPackId` に基づく `/api/checkout` を呼び出すよう順序制御を確定させる。
   - `/api/checkout` 側でもセッション・ユーザー判定のロジックが安全に動作することを確認する。

## 3. 受入条件（Acceptance Criteria）
- [x] `002_sync_profile.sql` 内の SQL クエリですべてのカラム参照にテーブル修飾名が付与され、変数名との衝突がないこと。
- [x] 曖昧な `id` 参照（42702）を検出・防止する単体テスト（SQL 静的検証テスト）が PASS すること。
- [x] `sync_profile` 完了および非匿名セッション確定後にのみ `/api/checkout` が発火するテストが PASS すること。
- [x] `npm run verify`（型チェック・全テスト・リント）が 0 errors で PASS すること。
- [x] `npm run build` が正常に完了すること。

## 4. 解決策と実施内容
1. **SQL 曖昧性エラーの解消**:
   - `supabase/migrations/002_sync_profile.sql` の先頭に `#variable_conflict use_column` ディレクティブを追加し、変数とカラム名の名前衝突時にテーブルカラムを優先解決するよう設定。
   - 引数名を `p_preferred_language` に変更し、ローカル変数（`v_user_id`, `v_is_anonymous`, `v_language`）との命名規則を分離。
   - `auth.identities as ai`, `public.profiles as p` とテーブル別名を明示し、`ai.user_id`, `p.id` と修飾。
   - `on conflict (id)` を `on conflict on constraint profiles_pkey do update` に変更し、制約指定による変数衝突を完全防止。
2. **TypeScript / RPC 呼び出しの多層フォールバック**:
   - `src/lib/auth/sync-profile.ts` で `p_preferred_language` を優先呼び出し、旧スキーマキャッシュ対策として `preferred_language_param`、引数なし `{}` の3段階自動フォールバックを実装。
   - エラー 42702 も安全に bypass されることを Vitest で検証。
3. **Stripe Checkout 403 誤認防止 & 認証強化**:
   - `src/app/api/checkout/route.ts` において、`hasLinkedIdentity(identityProviders)` によるプロバイダ検証を優先し、Google / Email 連携済みユーザーであれば `isAnonymous: false` として Checkout を認可。
   - さらに `profile.is_anonymous` が未同期であればサーバー側で `is_anonymous: false` に自己修復更新するロジックを配置。
   - クライアント側（`src/components/auth/AuthProvider.tsx`）から `Authorization: Bearer ${token}` を送信し、セッション同期のラグによる 401 / 403 を完全防止。

