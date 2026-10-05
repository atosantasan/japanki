-- Unlimited hearts is a separate one-time product from the travel pack.
-- Owning it skips the heart gate and the start-time decrement. Travel access stays on user_purchases.

create table public.billing_products (
  id text primary key,
  price_usd numeric(10,2) not null,
  stripe_price_id text,
  is_active boolean not null default true
);

insert into public.billing_products (id, price_usd)
values ('unlimited_hearts', 1.99);

create table public.user_unlimited_hearts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  stripe_payment_intent_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique (user_id)
);

create index idx_user_unlimited_hearts_stripe_payment_intent_id
  on public.user_unlimited_hearts (stripe_payment_intent_id);

alter table public.billing_products enable row level security;
alter table public.user_unlimited_hearts enable row level security;

revoke all on table public.billing_products from anon, authenticated;
grant select on table public.billing_products to anon, authenticated;

revoke all on table public.user_unlimited_hearts from anon, authenticated;
grant select on table public.user_unlimited_hearts to authenticated;

create policy "課金商品は誰でも閲覧可能"
  on public.billing_products for select
  using (true);

create policy "ユーザーは自身のハート無制限のみ閲覧可能"
  on public.user_unlimited_hearts for select
  using (auth.uid() = user_id);

create or replace function public.create_quiz_session(pack_id_param text)
returns table(session_id uuid) as $$
declare
  v_user_id uuid := auth.uid();
  v_session_id uuid;
  v_phrase_record record;
  v_pos integer := 1;
  v_is_free boolean;
  v_is_active boolean;
  v_has_purchased boolean;
  v_recent_starts integer;
  v_unlimited boolean;
  v_hearts integer;
  v_updated_at timestamp with time zone;
  v_now timestamp with time zone;
  v_elapsed_minutes integer;
  v_recovered_hearts integer;
  v_calc_hearts integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select is_free, is_active into v_is_free, v_is_active
  from public.content_packs
  where id = pack_id_param;
  if v_is_free is null then
    raise exception 'Content pack not found';
  end if;

  if not v_is_active then
    if v_is_free then
      raise exception 'Content pack not found';
    end if;

    select exists (
      select 1 from public.user_purchases
      where user_id = v_user_id and pack_id = pack_id_param
    ) into v_has_purchased;

    if not v_has_purchased then
      raise exception 'Content pack not found';
    end if;
  elsif not v_is_free then
    select exists (
      select 1 from public.user_purchases
      where user_id = v_user_id and pack_id = pack_id_param
    ) into v_has_purchased;

    if not v_has_purchased then
      raise exception 'Purchased pack permission required';
    end if;
  end if;

  select count(*) into v_recent_starts
  from public.quiz_sessions
  where user_id = v_user_id
    and created_at > now() - interval '1 hour';

  if v_recent_starts >= 20 then
    raise exception 'Rate limit exceeded';
  end if;

  select exists (
    select 1 from public.user_unlimited_hearts
    where user_id = v_user_id
  ) into v_unlimited;

  if not v_unlimited then
    select p.hearts, p.last_heart_updated_at
    into v_hearts, v_updated_at
    from public.profiles as p
    where p.id = v_user_id
    for update;

    v_now := timezone('utc'::text, now());
    v_updated_at := coalesce(v_updated_at, v_now);
    v_hearts := greatest(0, coalesce(v_hearts, 0));
    v_elapsed_minutes := greatest(
      0,
      floor(extract(epoch from (v_now - v_updated_at)) / 60)::integer
    );
    v_recovered_hearts := v_elapsed_minutes / 30;
    v_calc_hearts := least(5, v_hearts + v_recovered_hearts);

    if v_recovered_hearts > 0 and v_calc_hearts >= 5 then
      v_updated_at := v_now;
    end if;
    if v_recovered_hearts > 0 and v_calc_hearts < 5 then
      v_updated_at := v_updated_at + (v_recovered_hearts * interval '30 minutes');
    end if;

    if v_calc_hearts < 1 then
      raise exception 'No hearts remaining';
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

  if not v_unlimited then
    update public.profiles
    set hearts = v_calc_hearts - 1,
        last_heart_updated_at = v_updated_at
    where id = v_user_id;
  end if;

  return query select v_session_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.export_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'profile', (
      select to_jsonb(p)
      from public.profiles p
      where p.id = v_user_id
    ),
    'purchases', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', up.id,
            'pack_id', up.pack_id,
            'created_at', up.created_at,
            'stripe_payment_intent_id', up.stripe_payment_intent_id
          )
          order by up.created_at
        ),
        '[]'::jsonb
      )
      from public.user_purchases up
      where up.user_id = v_user_id
    ),
    'unlimited_hearts', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', uh.id,
            'created_at', uh.created_at,
            'stripe_payment_intent_id', uh.stripe_payment_intent_id
          )
          order by uh.created_at
        ),
        '[]'::jsonb
      )
      from public.user_unlimited_hearts uh
      where uh.user_id = v_user_id
    ),
    'quiz_sessions', (
      select coalesce(
        jsonb_agg(session_row.payload order by session_row.created_at),
        '[]'::jsonb
      )
      from (
        select
          qs.created_at,
          jsonb_build_object(
            'id', qs.id,
            'pack_id', qs.pack_id,
            'completed_at', qs.completed_at,
            'created_at', qs.created_at,
            'questions', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', qsq.id,
                    'phrase_id', qsq.phrase_id,
                    'position', qsq.position
                  )
                  order by qsq.position
                ),
                '[]'::jsonb
              )
              from public.quiz_session_questions qsq
              where qsq.session_id = qs.id
            ),
            'answers', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', qa.id,
                    'phrase_id', qa.phrase_id,
                    'is_correct', qa.is_correct,
                    'answered_at', qa.answered_at
                  )
                  order by qa.answered_at
                ),
                '[]'::jsonb
              )
              from public.quiz_answers qa
              where qa.session_id = qs.id
            ),
            'attempts', (
              select coalesce(
                jsonb_agg(
                  jsonb_build_object(
                    'id', qat.id,
                    'phrase_id', qat.phrase_id,
                    'first_incorrect_at', qat.first_incorrect_at
                  )
                  order by qat.first_incorrect_at
                ),
                '[]'::jsonb
              )
              from public.quiz_attempts qat
              where qat.session_id = qs.id
            )
          ) as payload
        from public.quiz_sessions qs
        where qs.user_id = v_user_id
      ) as session_row
    )
  ) into v_payload;

  return v_payload;
end;
$$;

revoke execute on function public.export_my_data() from public;
revoke execute on function public.export_my_data() from anon;
grant execute on function public.export_my_data() to authenticated;
