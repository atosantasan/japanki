# Japanki - 最終確定版要件定義書 (PRD v3.2 Final Freeze Note)

## 1. プロジェクト概要 ＆ プロダクト定義

- **プロダクト名**：Japanki
- **コンセプト**：海外のライト層・旅行者向け「1回1分（5問）、音で覚える」超軽量日本語学習PWA
- **ターゲット**：アニメファン、日本旅行予定者、従来の漢字や文法学習で挫折した初学者
- **対応UI/解説言語（全8言語対応）**：
  1. 英語 (`en`)
  2. 繁体字中国語 (`zh-TW`)
  3. 簡体字中国語 (`zh-CN`)
  4. 韓国語 (`ko`)
  5. タイ語 (`th`)
  6. フランス語 (`fr`)
  7. ドイツ語 (`de`)
  8. スペイン語 (`es`)
- **1セッションの定義**：1セッション ＝ 5問（1問あたり10〜15秒、計約1分）。1日に複数セッションのプレイが可能。5問達成ごとに「1分学習完了！」の達成感を演出。
- **技術スタック**：
  - **フロントエンド**：Next.js (App Router), TypeScript, Tailwind CSS, Lucide React, `next-intl`（多言語化）, `@ducanh2912/next-pwa`（PWA）, Zod (Schema Validation)
  - **バックエンド / DB**：Supabase (PostgreSQL, Auth, Storage, Database Functions / RPC)
  - **決済**：Stripe (Checkout & Webhook)
  - **インフラ**：Vercel

---

## 2. データベース構造 (Supabase DDL & Security Triggers)

以下のSQLを Supabase の SQL Editor で実行してテーブル、サーバー主導のセッション管理、多言語対応制約、およびセキュリティを考慮したアトミック処理関数を構築します。

```sql
create extension if not exists "uuid-ossp";

-- 1. profiles（ユーザー管理 & ハート状態 & 言語設定）
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  is_anonymous boolean default true,
  preferred_language text default 'en',
  hearts integer default 5 check (hearts >= 0 and hearts <= 5),
  last_heart_updated_at timestamp with time zone default timezone('utc'::text, now()),
  last_x_shared_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- auth.users INSERT時に自動でprofilesを作成するトリガー関数
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, is_anonymous, hearts, last_heart_updated_at)
  values (
    new.id,
    coalesce((new.raw_app_meta_data->>'provider') = 'anonymous', true),
    5,
    timezone('utc'::text, now())
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. content_packs（教材パック）
create table public.content_packs (
  id text primary key,
  title jsonb not null, -- 各言語タイトル {"en": "Survival", "zh-TW": "生存必備", ...}
  description jsonb, -- 各言語説明
  is_free boolean default false,
  price_usd numeric(4,2) default 0.00,
  stripe_price_id text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. phrases（クイズ問題データ - 多言語対応）
create table public.phrases (
  id uuid default gen_random_uuid() primary key,
  pack_id text references public.content_packs(id) on delete cascade not null,
  romaji text not null,
  japanese text not null,
  audio_url text not null,
  translations jsonb not null, -- 各言語の訳 {"en": "Thank you", ...}
  choices_by_lang jsonb not null, -- 各言語の選択肢 {"en": ["Thank you", "Sorry", "Hello"], ...}
  correct_choice_index integer not null check (correct_choice_index between 0 and 2),
  sort_order integer default 0
);

-- 4. quiz_sessions & quiz_session_questions & quiz_attempts（サーバー側5問確定＆重複減算防止構造）
create table public.quiz_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  pack_id text references public.content_packs(id) on delete cascade not null,
  completed_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table public.quiz_session_questions (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.quiz_sessions(id) on delete cascade not null,
  phrase_id uuid references public.phrases(id) on delete cascade not null,
  position integer not null check (position between 1 and 5),
  unique(session_id, position),
  unique(session_id, phrase_id)
);

create table public.quiz_attempts (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.quiz_sessions(id) on delete cascade not null,
  phrase_id uuid references public.phrases(id) on delete cascade not null,
  first_incorrect_at timestamp with time zone default timezone('utc'::text, now()),
  unique(session_id, phrase_id)
);

-- 5. user_purchases（購入履歴）
create table public.user_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  pack_id text references public.content_packs(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, pack_id)
);

-- 6. RPC: セッション開始時にサーバー側で購入権限を検証しランダム5問を抽出しセッションを作成する関数
create or replace function public.create_quiz_session(pack_id_param text)
returns table(session_id uuid) as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_phrase_record record;
  v_pos integer := 1;
  v_is_free boolean;
  v_has_purchased boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- 対象パックの有料/無料判定および購入権限の検証
  select is_free into v_is_free from public.content_packs where id = pack_id_param;
  if v_is_free is null then
    raise exception 'Content pack not found';
  end if;

  if not v_is_free then
    select exists (
      select 1 from public.user_purchases
      where user_id = v_user_id and pack_id = pack_id_param
    ) into v_has_purchased;

    if not v_has_purchased then
      raise exception 'Purchased pack permission required';
    end if;
  end if;

  -- quiz_sessionsの作成
  insert into public.quiz_sessions (user_id, pack_id)
  values (v_user_id, pack_id_param)
  returning id into v_session_id;

  -- パック内の全問題からランダムに5問を抽出して登録
  for v_phrase_record in (
    select id from public.phrases
    where pack_id = pack_id_param
    order by random()
    limit 5
  ) loop
    insert into public.quiz_session_questions (session_id, phrase_id, position)
    values (v_session_id, v_phrase_record.id, v_pos);
    v_pos := v_pos + 1;
  end loop;

  -- 5問抽出できなかった場合は例外を出してロールバック（5問未満のパックのプレイ不可）
  if v_pos <= 5 then
    raise exception 'Not enough phrases in the selected pack';
  end if;

  return query select v_session_id;
end;
$$ language plpgsql security definer set search_path = public;

-- 7. RPC: 競合を完全に回避しRETURNINGで確実なアトミック判定を行うハート減算関数
create or replace function public.consume_heart(session_id_param uuid, phrase_id_param uuid)
returns table(remaining_hearts integer, updated_at timestamp with time zone) as $$
declare
  v_user_id uuid := auth.uid();
  v_session_owner uuid;
  v_is_assigned boolean;
  v_attempt_id uuid := null;
  v_inserted boolean := false;
  v_hearts integer;
  v_last_updated timestamp with time zone;
  v_now timestamp with time zone := timezone('utc'::text, now());
  v_elapsed_minutes integer;
  v_recovered_hearts integer;
  v_calc_hearts integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- セッション所有権の検証
  select user_id into v_session_owner from public.quiz_sessions where id = session_id_param;
  if v_session_owner is null or v_session_owner != v_user_id then
    raise exception 'Unauthorized session access';
  end if;

  -- 対象問題がこのセッションに割り当てられているか検証
  select exists (
    select 1 from public.quiz_session_questions
    where session_id = session_id_param and phrase_id = phrase_id_param
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception 'Phrase not assigned to this session';
  end if;

  -- 誤答履歴をアトミックに記録し、RETURNINGで確実に新規INSERTか判定（FOUNDの脆弱性を回避）
  insert into public.quiz_attempts (session_id, phrase_id)
  values (session_id_param, phrase_id_param)
  on conflict (session_id, phrase_id) do nothing
  returning id into v_attempt_id;

  v_inserted := (v_attempt_id is not null);

  select hearts, last_heart_updated_at into v_hearts, v_last_updated
  from public.profiles where id = v_user_id;

  -- 既に過去に誤答済み（ON CONFLICT発生で新規INSERTされなかった）場合はハートを減算せず現状維持
  if not v_inserted then
    return query select v_hearts, v_last_updated;
    return;
  end if;

  -- 初回誤答時のみハート減算（排他ロックで計算）
  select hearts, last_heart_updated_at into v_hearts, v_last_updated
  from public.profiles where id = v_user_id for update;

  -- 自然回復の計算 (30分で1回復)
  v_elapsed_minutes := extract(epoch from (v_now - v_last_updated)) / 60;
  v_recovered_hearts := v_elapsed_minutes / 30;
  v_calc_hearts := least(5, v_hearts + v_recovered_hearts);

  if v_calc_hearts > 0 then
    v_calc_hearts := v_calc_hearts - 1;
    v_last_updated := v_now;
  end if;

  update public.profiles
  set hearts = v_calc_hearts,
      last_heart_updated_at = v_last_updated
  where id = v_user_id;

  return query select v_calc_hearts, v_last_updated;
end;
$$ language plpgsql security definer set search_path = public;

-- 権限設定：RPCの実行権限を authenticated のみに限定
revoke execute on function public.create_quiz_session(text) from public;
grant execute on function public.create_quiz_session(text) to authenticated;
revoke execute on function public.consume_heart(uuid, uuid) from public;
grant execute on function public.consume_heart(uuid, uuid) to authenticated;

-- RLS（Row Level Security）ポリシー設定
-- ※注意: クライアントからの直接INSERT/UPDATE/DELETEポリシーは意図的に作成しない。
-- テーブル変更操作はすべて SECURITY DEFINER RPC（またはサーバーサイド専用Admin操作）経由に限定する。
alter table public.profiles enable row level security;
alter table public.content_packs enable row level security;
alter table public.phrases enable row level security;
alter table public.quiz_sessions enable row level security;
alter table public.quiz_session_questions enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.user_purchases enable row level security;

create policy "教材パックは誰でも閲覧可能" on public.content_packs for select using (true);
create policy "無料問題のみクライアントから閲覧可能" on public.phrases for select using (
  pack_id in (select id from public.content_packs where is_free = true)
);
create policy "ユーザーは自身のプロフィールのみ閲覧可能" on public.profiles for select using (auth.uid() = id);
create policy "ユーザーは自身のセッションのみ操作可能" on public.quiz_sessions for select using (auth.uid() = user_id);
create policy "ユーザーは自身のセッション問題のみ閲覧可能" on public.quiz_session_questions for select using (
  session_id in (select id from public.quiz_sessions where user_id = auth.uid())
);
create policy "ユーザーは自身の購入履歴のみ閲覧可能" on public.user_purchases for select using (auth.uid() = user_id);
```

---

## 3. バックエンド ＆ セキュリティ仕様

### 1. サーバー主導のクイズセッション ＆ ハート管理

- クライアントは RPC `create_quiz_session(pack_id)` を呼び出し。有料パックの権限チェックを通過後、サーバー側で確定された5問の `session_id` を受け取る。
- ハート減算は `consume_heart(session_id, phrase_id)` を呼び出し。内部で `INSERT ... ON CONFLICT DO NOTHING RETURNING id` により競合条件および状態判定の誤動作を排除。
- セッションに割り当てられていない `phrase_id` に対するハート減算要求は例外を出して拒否。

### 2. 有料コンテンツ（Phrases）のアクセス保護

- 有料パックの問題データ（`phrases`）は RLS により直接 SELECT を遮断。
- API Route（`/api/phrases?pack_id=xxx`）を用意し、サーバー側で `SUPABASE_SECRET_KEY` を使用して `user_purchases` に購入記録が存在するか検証した上でデータを返却。

### 3. 匿名ユーザーの課金制限 ＆ 厳格な認証検証

- Stripe Checkout 開始時、`profiles.is_anonymous` の値だけでなく、Supabase Auth サーバーAPIを通じて認証ユーザーの Identity 情報を検証する。
- `is_anonymous = true` かつ Identity 未接続の場合は Checkout 遷移を拒否し、Google / Email 連携（Identity Linking）モーダルを表示。

### 4. 既存アカウント連携（Identity Linking）時の衝突防止

- すでに他のアカウントに紐付いている Google アカウントへ連携しようとした場合、自動マージ処理は行わず、既存アカウントへのログインを案内するエラーメッセージを表示する。

### 5. Stripe 決済 ＆ Webhook（idempotent 冪等性保証）

- Success URLでは購入確定処理を行わず、Stripe Webhook (`/api/stripe-webhook`) の署名検証（`STRIPE_WEBHOOK_SECRET`）のみを購入確定の根拠とする。
- `user_purchases` テーブルの `unique(user_id, pack_id)` 制約により、同一 Webhook イベントの二重受信時も冪等性を維持して安全に処理する。

---

## 4. 出題ロジック ＆ 多言語学習仕様

### 1. 出題・シャッフルロジック

- 選択肢（3択）の配列順序（`choices_by_lang`）は、正解テキストを基準として UI 表示時にランダムにシャッフルし、インデックスズレを未然に防ぐ。

### 2. 多言語化 (i18n & Zod Schema Validation)

- `next-intl` を使用し、8言語（`en`, `zh-TW`, `zh-CN`, `ko`, `th`, `fr`, `de`, `es`）に対応。
- Zod スキーマにより、DB・APIレスポンスに含まれる JSON データが全8言語のキーを満たしているかを実行時に型安全検証する。

### 3. 音声再生フォールバック

- 問題表示時に音声自動再生を試行。iOS Safari等でブロックされた場合は、カード上に大きな手動再生ボタンを表示。
