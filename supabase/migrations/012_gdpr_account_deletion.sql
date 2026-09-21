-- Issue #20: GDPR account deletion keeps purchase rows for tax/refund matching.
-- Quiz rows still follow quiz_sessions.user_id ON DELETE CASCADE (no change).
-- user_purchases.user_id becomes nullable and SET NULL when the profile is removed.

alter table public.user_purchases
  alter column user_id drop not null;

alter table public.user_purchases
  drop constraint user_purchases_user_id_fkey,
  add constraint user_purchases_user_id_fkey
    foreign key (user_id) references public.profiles(id) on delete set null;

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
