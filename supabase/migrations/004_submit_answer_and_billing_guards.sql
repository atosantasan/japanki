-- Non-destructive: named UNIQUE for quiz_attempts ON CONFLICT, submit_answer RPC,
-- and Stripe payment_intent tracking for refund revocation.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quiz_attempts_session_id_phrase_id_key'
      and conrelid = 'public.quiz_attempts'::regclass
  ) then
    alter table public.quiz_attempts
      add constraint quiz_attempts_session_id_phrase_id_key unique (session_id, phrase_id);
  end if;
end $$;

alter table public.user_purchases
  add column if not exists stripe_payment_intent_id text;

create index if not exists idx_user_purchases_stripe_payment_intent_id
  on public.user_purchases (stripe_payment_intent_id);

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

  return query select v_is_correct, v_hearts, v_updated_at, v_correct_text;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.submit_answer(uuid, uuid, text, text) from public;
grant execute on function public.submit_answer(uuid, uuid, text, text) to authenticated;
