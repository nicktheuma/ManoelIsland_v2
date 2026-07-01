-- Admin reset: wipe all sculpt strokes for a terrain key

create or replace function public.reset_terrain_sculpt_strokes (
  p_terrain_key text,
  p_admin_password text default ''
)
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
    raise exception 'Authentication required.';
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
    raise exception 'Admin authorization failed.';
  end if;

  if not public.is_rate_limit_exempt(auth.uid()) then
    raise exception 'Admin authorization failed.';
  end if;

  delete from public.terrain_sculpt_strokes
  where terrain_key = p_terrain_key;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

grant execute on function public.reset_terrain_sculpt_strokes (text, text) to authenticated;
