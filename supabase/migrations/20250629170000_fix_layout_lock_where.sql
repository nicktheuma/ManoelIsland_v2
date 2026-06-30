-- Fix set_layout_locked for Supabase pg_safeupdate (UPDATE requires WHERE clause)

create or replace function public.set_layout_locked (p_locked boolean default true)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null or not public.is_admin_caller() then
    raise exception 'Unauthorized';
  end if;

  update public.sandbox_settings
  set
    layout_locked = p_locked,
    updated_at = now()
  where id = 1;

  update public.placed_props
  set is_locked = p_locked
  where id is not null;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
