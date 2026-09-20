-- Issue #17 follow-up: rate-limit submit_answer inside the RPC.
-- Threshold matches SUBMIT_ANSWER_RATE_LIMIT_PER_HOUR in src/lib/constants/app.ts.
-- Pattern matches create_quiz_session in 009: COUNT the last hour, then
-- raise exception 'Rate limit exceeded'. A dedicated log table is required
-- because unlike quiz_sessions, submit_answer does not insert a row on every call.

create table if not exists public.submit_answer_calls (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  called_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_submit_answer_calls_user_id_called_at
  on public.submit_answer_calls (user_id, called_at);

alter table public.submit_answer_calls enable row level security;

revoke all on table public.submit_answer_calls from public;
revoke all on table public.submit_answer_calls from anon;
revoke all on table public.submit_answer_calls from authenticated;

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
  v_recent_calls integer;
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
    where p.id = v_user_id;
  end if;

  insert into public.submit_answer_calls (user_id, called_at)
  values (v_user_id, timezone('utc'::text, now()));

  return query select v_is_correct, v_hearts, v_updated_at, v_correct_text;
end;
$$ language plpgsql security definer set search_path = public;
