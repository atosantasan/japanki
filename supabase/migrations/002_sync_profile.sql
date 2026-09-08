-- Non-destructive: profile sync RPC for identity linking.
-- Client UPDATE policies remain absent; only this SECURITY DEFINER RPC can update the caller's row.

-- Drop overloaded definitions to prevent signature ambiguity and 400 Bad Request
drop function if exists public.sync_profile();
drop function if exists public.sync_profile(text);

create or replace function public.sync_profile(p_preferred_language text default null)
returns table(
  id uuid,
  is_anonymous boolean,
  preferred_language text,
  hearts integer,
  last_heart_updated_at timestamp with time zone
) as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_is_anonymous boolean;
  v_language text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select not exists (
    select 1
    from auth.identities as ai
    where ai.user_id = v_user_id
      and ai.provider <> 'anonymous'
  ) into v_is_anonymous;

  select p.preferred_language into v_language
  from public.profiles as p
  where p.id = v_user_id;

  if p_preferred_language is not null then
    v_language := p_preferred_language;
  end if;

  if v_language is null then
    v_language := 'en';
  end if;

  insert into public.profiles (id, is_anonymous, preferred_language, hearts, last_heart_updated_at)
  values (v_user_id, v_is_anonymous, v_language, 5, timezone('utc'::text, now()))
  on conflict on constraint profiles_pkey do update
    set is_anonymous = excluded.is_anonymous,
        preferred_language = excluded.preferred_language;

  return query
    select
      p.id,
      p.is_anonymous,
      p.preferred_language,
      p.hearts,
      p.last_heart_updated_at
    from public.profiles as p
    where p.id = v_user_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.sync_profile(text) from public;
grant execute on function public.sync_profile(text) to authenticated;
