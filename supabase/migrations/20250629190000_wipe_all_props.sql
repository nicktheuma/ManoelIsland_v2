-- Admin-only: delete every placed prop on the map (password or admin profile)

drop function if exists public.wipe_all_props ();

create or replace function public.wipe_all_props (p_admin_password text default '')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_password text;
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Unauthorized';
  end if;

  select admin_password
  into stored_password
  from public.sandbox_settings
  where id = 1;

  if stored_password is not null
    and stored_password <> ''
    and p_admin_password is distinct from stored_password
    and not public.is_rate_limit_exempt(auth.uid())
  then
    raise exception 'Unauthorized';
  end if;

  insert into public.admin_sessions (user_id, expires_at)
  values (auth.uid(), now() + interval '24 hours')
  on conflict (user_id) do update
  set expires_at = excluded.expires_at;

  with deleted as (
    delete from public.placed_props
    returning 1
  )
  select count(*)
  into deleted_count
  from deleted;

  return deleted_count;
end;
$$;

comment on function public.wipe_all_props (text) is
  'Admin-only: deletes all placed_props. Pass sandbox admin password or use an admin profile.';

grant execute on function public.wipe_all_props (text) to authenticated;
