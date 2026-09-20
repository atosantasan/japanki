-- Issue #24: widen content_packs.price_usd from numeric(4,2) to numeric(10,2)
-- so prices of $100.00 and above can be stored. Existing $0.00 / $2.99 rows
-- cast in place; no USING rewrite is required.
--
-- Issue #37: add content_packs.is_active for logical retirement.
-- Resolves the follow-up TODO in 005_fk_on_delete_policy.sql. Packs stay
-- protected by ON DELETE RESTRICT; retire them with is_active = false.
-- Existing Survival / Travel rows receive DEFAULT true.

alter table public.content_packs
  alter column price_usd type numeric(10,2);

alter table public.content_packs
  add column if not exists is_active boolean not null default true;

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

  select is_free into v_is_free
  from public.content_packs
  where id = pack_id_param and is_active = true;
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

drop policy if exists "無料問題のみクライアントから閲覧可能" on public.phrases;
create policy "無料問題のみクライアントから閲覧可能" on public.phrases for select using (
  pack_id in (
    select id from public.content_packs
    where is_free = true and is_active = true
  )
);
