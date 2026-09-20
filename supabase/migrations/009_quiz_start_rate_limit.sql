-- Issue #17: hourly rate-limit for create_quiz_session.
-- Counts existing quiz_sessions instead of adding a dedicated counter table.
-- Threshold matches QUIZ_START_RATE_LIMIT_PER_HOUR in src/lib/constants/app.ts.

create index if not exists idx_quiz_sessions_user_id_created_at
  on public.quiz_sessions (user_id, created_at);

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
