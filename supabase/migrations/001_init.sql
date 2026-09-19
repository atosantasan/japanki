-- Japanki PRD v3.2 — Phase 1 schema, indexes, RLS, and RPCs
-- Apply via Supabase SQL Editor or the Supabase CLI.

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
  title jsonb not null,
  description jsonb,
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
  translations jsonb not null,
  choices_by_lang jsonb not null,
  correct_choice_index integer not null check (correct_choice_index between 0 and 2),
  sort_order integer default 0
);

-- 4. quiz_sessions & quiz_session_questions & quiz_attempts
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
  constraint quiz_attempts_session_id_phrase_id_key unique (session_id, phrase_id)
);

-- 5. user_purchases（購入履歴）
create table public.user_purchases (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  pack_id text references public.content_packs(id) on delete cascade not null,
  stripe_payment_intent_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(user_id, pack_id)
);

-- Foreign-key and lookup indexes (unique constraints already index composite keys)
create index idx_phrases_pack_id on public.phrases (pack_id);
create index idx_quiz_sessions_user_id on public.quiz_sessions (user_id);
create index idx_quiz_sessions_pack_id on public.quiz_sessions (pack_id);
create index idx_quiz_session_questions_session_id on public.quiz_session_questions (session_id);
create index idx_quiz_session_questions_phrase_id on public.quiz_session_questions (phrase_id);
create index idx_quiz_attempts_session_id on public.quiz_attempts (session_id);
create index idx_quiz_attempts_phrase_id on public.quiz_attempts (phrase_id);
create index idx_user_purchases_user_id on public.user_purchases (user_id);
create index idx_user_purchases_pack_id on public.user_purchases (pack_id);
create index idx_user_purchases_stripe_payment_intent_id on public.user_purchases (stripe_payment_intent_id);

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

  insert into public.quiz_sessions (user_id, pack_id)
  values (v_user_id, pack_id_param)
  returning id into v_session_id;

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

  select user_id into v_session_owner from public.quiz_sessions where id = session_id_param;
  if v_session_owner is null or v_session_owner != v_user_id then
    raise exception 'Unauthorized session access';
  end if;

  select exists (
    select 1 from public.quiz_session_questions
    where session_id = session_id_param and phrase_id = phrase_id_param
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception 'Phrase not assigned to this session';
  end if;

  insert into public.quiz_attempts (session_id, phrase_id)
  values (session_id_param, phrase_id_param)
  on conflict (session_id, phrase_id) do nothing
  returning id into v_attempt_id;

  v_inserted := (v_attempt_id is not null);

  select hearts, last_heart_updated_at into v_hearts, v_last_updated
  from public.profiles where id = v_user_id;

  if not v_inserted then
    return query select v_hearts, v_last_updated;
    return;
  end if;

  select hearts, last_heart_updated_at into v_hearts, v_last_updated
  from public.profiles where id = v_user_id for update;

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

revoke execute on function public.create_quiz_session(text) from public;
grant execute on function public.create_quiz_session(text) to authenticated;
revoke execute on function public.consume_heart(uuid, uuid) from public;
grant execute on function public.consume_heart(uuid, uuid) to authenticated;

-- RLS: client INSERT/UPDATE/DELETE policies are intentionally omitted.
-- Table mutations go through SECURITY DEFINER RPCs or server-side admin operations.
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
