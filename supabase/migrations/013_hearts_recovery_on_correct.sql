-- Persist recovered hearts on correct grades.
-- QuizPlay treats remaining_hearts as playable hearts; returning the stored
-- zero after a correct answer locked play while the header showed a full refill.

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
    select ch.remaining_hearts, ch.updated_at
    into v_hearts, v_updated_at
    from public.consume_heart(session_id_param, phrase_id_param) as ch;
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

revoke execute on function public.submit_answer(uuid, uuid, text, text) from public;
grant execute on function public.submit_answer(uuid, uuid, text, text) to authenticated;
