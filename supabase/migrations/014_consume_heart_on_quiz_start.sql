-- Issue #52: spend one heart when a 5-question session starts.
-- Grading no longer calls consume_heart. A direct consume_heart call does not decrement.

create or replace function public.consume_heart(session_id_param uuid, phrase_id_param uuid)
returns table(remaining_hearts integer, updated_at timestamp with time zone) as $$
declare
  v_user_id uuid := auth.uid();
  v_hearts integer;
  v_last_updated timestamp with time zone;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Heart spend moved to create_quiz_session. Keep the signature so older clients
  -- cannot decrement hearts by calling this RPC directly.
  select p.hearts, p.last_heart_updated_at
  into v_hearts, v_last_updated
  from public.profiles as p
  where p.id = v_user_id;

  return query select v_hearts, v_last_updated;
end;
$$ language plpgsql security definer set search_path = public;

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

  update public.profiles
  set hearts = v_calc_hearts - 1,
      last_heart_updated_at = v_updated_at
  where id = v_user_id;

  return query select v_session_id;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.submit_answer(
  session_id_param uuid,
  phrase_id_param uuid,
  selected_choice_text text,
  locale_param text default 'en'
)
returns table(
  is_correct boolean,
  remaining_hearts integer,
  updated_at timestamp with time zone,
  correct_choice_text text
) as $$
declare
  v_user_id uuid := auth.uid();
  v_session_owner uuid;
  v_is_assigned boolean;
  v_locale text;
  v_choices jsonb;
  v_correct_text text;
  v_is_correct boolean;
  v_hearts integer;
  v_updated_at timestamp with time zone;
  v_now timestamp with time zone;
  v_elapsed_minutes integer;
  v_recovered_hearts integer;
  v_calc_hearts integer;
  v_recent_calls integer;
  v_answer_count integer;
  v_assigned_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select qs.user_id into v_session_owner
  from public.quiz_sessions as qs
  where qs.id = session_id_param;
  if v_session_owner is null or v_session_owner != v_user_id then
    raise exception 'Unauthorized session access';
  end if;

  select exists (
    select 1
    from public.quiz_session_questions as qsq
    where qsq.session_id = session_id_param
      and qsq.phrase_id = phrase_id_param
  ) into v_is_assigned;

  if not v_is_assigned then
    raise exception 'Phrase not assigned to this session';
  end if;

  select count(*) into v_recent_calls
  from public.submit_answer_calls
  where user_id = v_user_id
    and called_at > now() - interval '1 hour';

  if v_recent_calls >= 60 then
    raise exception 'Rate limit exceeded';
  end if;

  v_locale := coalesce(nullif(locale_param, ''), 'en');
  if v_locale = 'ja' then
    v_locale := 'en';
  end if;

  select
    p.choices_by_lang -> v_locale,
    p.choices_by_lang -> v_locale ->> p.correct_choice_index
  into v_choices, v_correct_text
  from public.phrases as p
  where p.id = phrase_id_param;

  if v_choices is null or v_correct_text is null then
    raise exception 'Invalid locale or phrase';
  end if;

  if selected_choice_text is null or not exists (
    select 1
    from jsonb_array_elements_text(v_choices) as choice(value)
    where choice.value = selected_choice_text
  ) then
    raise exception 'Invalid choice';
  end if;

  v_is_correct := (selected_choice_text = v_correct_text);

  if not v_is_correct then
    select p.hearts, p.last_heart_updated_at
    into v_hearts, v_updated_at
    from public.profiles as p
    where p.id = v_user_id;
  else
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
    v_hearts := v_calc_hearts;

    if v_recovered_hearts > 0 and v_calc_hearts >= 5 then
      v_updated_at := v_now;
    end if;
    if v_recovered_hearts > 0 and v_calc_hearts < 5 then
      v_updated_at := v_updated_at + (v_recovered_hearts * interval '30 minutes');
    end if;
    if v_recovered_hearts > 0 then
      update public.profiles
      set hearts = v_hearts,
          last_heart_updated_at = v_updated_at
      where id = v_user_id;
    end if;
  end if;

  insert into public.quiz_answers (session_id, phrase_id, is_correct)
  values (session_id_param, phrase_id_param, v_is_correct)
  on conflict (session_id, phrase_id) do nothing;

  select count(distinct phrase_id) into v_answer_count
  from public.quiz_answers
  where session_id = session_id_param;

  select count(*) into v_assigned_count
  from public.quiz_session_questions
  where session_id = session_id_param;

  if v_assigned_count > 0 and v_answer_count = v_assigned_count then
    update public.quiz_sessions
    set completed_at = timezone('utc'::text, now())
    where id = session_id_param
      and completed_at is null;
  end if;

  insert into public.submit_answer_calls (user_id, called_at)
  values (v_user_id, timezone('utc'::text, now()));

  return query select v_is_correct, v_hearts, v_updated_at, v_correct_text;
end;
$$ language plpgsql security definer set search_path = public;
